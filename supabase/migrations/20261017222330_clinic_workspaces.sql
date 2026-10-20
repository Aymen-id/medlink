BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE TABLE public.billing_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_admin_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.physician_workspaces (
  -- Keep legacy owner_id/profile identifiers stable so patient records never move.
  id uuid PRIMARY KEY REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  billing_account_id uuid NOT NULL REFERENCES public.billing_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX physician_workspaces_billing_idx ON public.physician_workspaces(billing_account_id);
CREATE TABLE public.workspace_memberships (
  workspace_id uuid NOT NULL REFERENCES public.physician_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK(role IN ('owner','receptionist','assistant')),
  permissions text NOT NULL CHECK(permissions IN ('view','edit')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,user_id),
  CHECK(role <> 'owner' OR permissions = 'edit')
);
CREATE INDEX workspace_memberships_user_idx ON public.workspace_memberships(user_id,workspace_id);

ALTER TABLE public.doctor_profiles ADD CONSTRAINT doctor_profile_identity CHECK(id=user_id) NOT VALID;
ALTER TABLE public.doctor_profiles VALIDATE CONSTRAINT doctor_profile_identity;
INSERT INTO public.billing_accounts(billing_admin_id) SELECT user_id FROM public.doctor_profiles;
INSERT INTO public.physician_workspaces(id,owner_user_id,billing_account_id)
SELECT p.id,p.user_id,b.id FROM public.doctor_profiles p JOIN public.billing_accounts b ON b.billing_admin_id=p.user_id;
INSERT INTO public.workspace_memberships(workspace_id,user_id,role,permissions)
SELECT id,owner_user_id,'owner','edit' FROM public.physician_workspaces;
INSERT INTO public.workspace_memberships(workspace_id,user_id,role,permissions)
SELECT owner_id,staff_user_id,role,permissions FROM public.staff_access WHERE owner_id<>staff_user_id;

ALTER TABLE public.subscriptions ADD COLUMN billing_account_id uuid REFERENCES public.billing_accounts(id);
UPDATE public.subscriptions s SET billing_account_id=w.billing_account_id FROM public.physician_workspaces w WHERE s.user_id=w.id;
CREATE UNIQUE INDEX subscriptions_billing_account_idx ON public.subscriptions(billing_account_id);

-- Private lookups break RLS recursion while always deriving identity from Auth.
CREATE FUNCTION private.workspace_access(workspace uuid, require_edit boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.workspace_memberships m
    WHERE m.workspace_id=workspace AND m.user_id=(SELECT auth.uid())
      AND (NOT require_edit OR m.permissions='edit')
  );
$$;
CREATE FUNCTION private.workspace_owner(workspace uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.physician_workspaces w WHERE w.id=workspace AND w.owner_user_id=(SELECT auth.uid())
  );
$$;
CREATE FUNCTION private.billing_admin(account uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.billing_accounts b WHERE b.id=account AND b.billing_admin_id=(SELECT auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION private.workspace_access(uuid,boolean), private.workspace_owner(uuid), private.billing_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.workspace_access(uuid,boolean), private.workspace_owner(uuid), private.billing_admin(uuid) TO authenticated;

ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physician_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_memberships ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.billing_accounts,public.physician_workspaces,public.workspace_memberships TO authenticated;
CREATE POLICY billing_admin_read ON public.billing_accounts FOR SELECT TO authenticated USING(billing_admin_id=(SELECT auth.uid()));
CREATE POLICY workspace_read ON public.physician_workspaces FOR SELECT TO authenticated
USING(private.workspace_access(id) OR private.billing_admin(billing_account_id));
CREATE POLICY membership_read ON public.workspace_memberships FOR SELECT TO authenticated
USING(user_id=(SELECT auth.uid()) OR private.workspace_owner(workspace_id));
CREATE POLICY workspace_member_profile_read ON public.doctor_profiles FOR SELECT TO authenticated USING(private.workspace_access(id));

CREATE FUNCTION private.bootstrap_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE account uuid;
BEGIN
  INSERT INTO public.billing_accounts(billing_admin_id) VALUES(NEW.user_id)
  ON CONFLICT(billing_admin_id) DO UPDATE SET billing_admin_id=EXCLUDED.billing_admin_id RETURNING id INTO account;
  INSERT INTO public.physician_workspaces(id,owner_user_id,billing_account_id) VALUES(NEW.id,NEW.user_id,account);
  INSERT INTO public.workspace_memberships(workspace_id,user_id,role,permissions) VALUES(NEW.id,NEW.user_id,'owner','edit');
  INSERT INTO public.subscriptions(user_id,billing_account_id) VALUES(NEW.id,account) ON CONFLICT(user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.bootstrap_workspace() FROM PUBLIC;
CREATE TRIGGER bootstrap_physician_workspace AFTER INSERT ON public.doctor_profiles FOR EACH ROW EXECUTE FUNCTION private.bootstrap_workspace();

COMMIT;
