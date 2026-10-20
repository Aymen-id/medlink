BEGIN;

CREATE TABLE public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_account_id uuid NOT NULL REFERENCES public.billing_accounts(id),
  workspace_id uuid REFERENCES public.physician_workspaces(id) ON DELETE CASCADE,
  invited_email text NOT NULL CHECK(invited_email=lower(trim(invited_email))),
  kind text NOT NULL CHECK(kind IN ('staff','provider')),
  role text NOT NULL CHECK(role IN ('receptionist','assistant')),
  permissions text NOT NULL CHECK(permissions IN ('view','edit')),
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','revoked','expired')),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
  accepted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(kind<>'staff' OR workspace_id IS NOT NULL)
);
CREATE INDEX team_invitation_account_idx ON public.team_invitations(billing_account_id,status,expires_at);
CREATE INDEX team_invitation_email_idx ON public.team_invitations(invited_email,status);
CREATE UNIQUE INDEX team_invitation_pending_idx ON public.team_invitations(billing_account_id,coalesce(workspace_id,'00000000-0000-0000-0000-000000000000'),invited_email,kind) WHERE status='pending';
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION private.current_email() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT lower(email) FROM auth.users WHERE id=(SELECT auth.uid()) AND email_confirmed_at IS NOT NULL;
$$;
CREATE FUNCTION private.workspace_tier(workspace uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT coalesce((SELECT s.tier FROM public.physician_workspaces w JOIN public.subscriptions s ON s.billing_account_id=w.billing_account_id
    WHERE w.id=workspace AND s.status IN ('active','trialing') AND (s.current_period_end IS NULL OR s.current_period_end>now())),'free');
$$;
REVOKE ALL ON FUNCTION private.current_email(),private.workspace_tier(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_email(),private.workspace_tier(uuid) TO authenticated;
CREATE POLICY invitation_read ON public.team_invitations FOR SELECT TO authenticated USING(
  invited_by=(SELECT auth.uid()) OR invited_email=private.current_email() OR private.billing_admin(billing_account_id) OR private.workspace_owner(workspace_id)
);
GRANT SELECT ON public.team_invitations TO authenticated;

CREATE OR REPLACE FUNCTION private.workspace_access(workspace uuid, require_edit boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.workspace_memberships m WHERE m.workspace_id=workspace AND m.user_id=(SELECT auth.uid())
    AND (NOT require_edit OR m.permissions='edit')
    AND (m.role='owner' OR private.workspace_tier(workspace)='clinic')
  );
$$;

CREATE FUNCTION private.sync_staff_membership() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    DELETE FROM public.workspace_memberships WHERE workspace_id=OLD.owner_id AND user_id=OLD.staff_user_id AND role<>'owner';
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND (NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.staff_user_id IS DISTINCT FROM OLD.staff_user_id) THEN RAISE EXCEPTION 'Staff assignment identity cannot change'; END IF;
  IF private.workspace_tier(NEW.owner_id)<>'clinic' THEN RAISE EXCEPTION 'Clinic subscription required for staff access'; END IF;
  IF NEW.owner_id=NEW.staff_user_id THEN RAISE EXCEPTION 'Cannot grant staff access to the physician owner'; END IF;
  INSERT INTO public.workspace_memberships(workspace_id,user_id,role,permissions)
  VALUES(NEW.owner_id,NEW.staff_user_id,NEW.role,NEW.permissions)
  ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=EXCLUDED.role,permissions=EXCLUDED.permissions;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.sync_staff_membership() FROM PUBLIC;
CREATE TRIGGER sync_staff_membership AFTER INSERT OR UPDATE OR DELETE ON public.staff_access FOR EACH ROW EXECUTE FUNCTION private.sync_staff_membership();

CREATE FUNCTION private.create_team_invitation(account uuid, workspace uuid, email text, invitation_kind text, staff_role text, access_level text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE invitation uuid; used_seats integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM 1 FROM public.billing_accounts WHERE id=account FOR UPDATE;
  IF invitation_kind='provider' THEN
    IF NOT private.billing_admin(account) THEN RAISE EXCEPTION 'Billing administrator required'; END IF;
    workspace:=NULL;
  ELSIF invitation_kind='staff' THEN
    IF NOT private.workspace_owner(workspace) OR NOT EXISTS(SELECT 1 FROM public.physician_workspaces w WHERE w.id=workspace AND w.billing_account_id=account) THEN RAISE EXCEPTION 'Workspace owner required'; END IF;
  ELSE RAISE EXCEPTION 'Invalid invitation kind'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.subscriptions s WHERE s.billing_account_id=account AND s.tier='clinic' AND s.status IN ('active','trialing') AND (s.current_period_end IS NULL OR s.current_period_end>now())) THEN RAISE EXCEPTION 'Active Clinic subscription required'; END IF;
  IF lower(trim(email))=private.current_email() THEN RAISE EXCEPTION 'Cannot invite yourself'; END IF;
  IF length(email)>254 OR email NOT LIKE '%@%' THEN RAISE EXCEPTION 'Invalid email'; END IF;
  UPDATE public.team_invitations SET status='expired' WHERE billing_account_id=account AND status='pending' AND expires_at<=now();
  IF invitation_kind='provider' THEN
    SELECT (SELECT count(*) FROM public.physician_workspaces WHERE billing_account_id=account)+
      (SELECT count(*) FROM public.team_invitations WHERE billing_account_id=account AND kind='provider' AND status='pending' AND expires_at>now()) INTO used_seats;
    IF used_seats>=8 THEN RAISE EXCEPTION 'Clinic supports at most eight physician workspaces, including pending invitations'; END IF;
  END IF;
  INSERT INTO public.team_invitations(billing_account_id,workspace_id,invited_email,kind,role,permissions,invited_by)
  VALUES(account,workspace,lower(trim(email)),invitation_kind,staff_role,access_level,(SELECT auth.uid())) RETURNING id INTO invitation;
  RETURN invitation;
END;
$$;

CREATE FUNCTION private.accept_team_invitation(invitation_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE invitation public.team_invitations; previous_account uuid; target uuid;
BEGIN
  SELECT * INTO invitation FROM public.team_invitations WHERE id=invitation_id;
  IF invitation.id IS NULL THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  PERFORM 1 FROM public.billing_accounts WHERE id=invitation.billing_account_id FOR UPDATE;
  SELECT * INTO invitation FROM public.team_invitations WHERE id=invitation_id FOR UPDATE;
  IF invitation.invited_email IS DISTINCT FROM private.current_email() THEN RAISE EXCEPTION 'This invitation requires its confirmed recipient email'; END IF;
  IF invitation.status<>'pending' OR invitation.expires_at<=now() THEN RAISE EXCEPTION 'Invitation expired or no longer pending'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.subscriptions s WHERE s.billing_account_id=invitation.billing_account_id AND s.tier='clinic' AND s.status IN ('active','trialing') AND (s.current_period_end IS NULL OR s.current_period_end>now())) THEN RAISE EXCEPTION 'Active Clinic subscription required'; END IF;
  IF invitation.kind='provider' THEN
    SELECT id,billing_account_id INTO target,previous_account FROM public.physician_workspaces WHERE owner_user_id=(SELECT auth.uid()) FOR UPDATE;
    IF target IS NULL THEN RAISE EXCEPTION 'A physician workspace is required'; END IF;
    IF EXISTS(SELECT 1 FROM public.subscriptions WHERE billing_account_id=previous_account AND tier<>'free' AND status IN ('active','trialing','past_due')) THEN RAISE EXCEPTION 'Resolve the existing paid subscription before joining this Clinic'; END IF;
    IF (SELECT count(*) FROM public.physician_workspaces WHERE billing_account_id=invitation.billing_account_id)>=8 THEN RAISE EXCEPTION 'No provider seat available'; END IF;
    UPDATE public.physician_workspaces SET billing_account_id=invitation.billing_account_id WHERE id=target;
  ELSE
    target:=invitation.workspace_id;
    INSERT INTO public.staff_access(owner_id,staff_user_id,role,permissions) VALUES(target,(SELECT auth.uid()),invitation.role,invitation.permissions)
    ON CONFLICT(owner_id,staff_user_id) DO UPDATE SET role=EXCLUDED.role,permissions=EXCLUDED.permissions;
  END IF;
  UPDATE public.team_invitations SET status='accepted',accepted_by=(SELECT auth.uid()) WHERE id=invitation_id;
  RETURN target;
END;
$$;

CREATE FUNCTION private.revoke_team_invitation(invitation_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE invitation public.team_invitations;
BEGIN
  SELECT * INTO invitation FROM public.team_invitations WHERE id=invitation_id;
  IF NOT (private.billing_admin(invitation.billing_account_id) OR private.workspace_owner(invitation.workspace_id)) THEN RAISE EXCEPTION 'Invitation management denied'; END IF;
  PERFORM 1 FROM public.billing_accounts WHERE id=invitation.billing_account_id FOR UPDATE;
  UPDATE public.team_invitations SET status='revoked' WHERE id=invitation_id AND status='pending';
END;
$$;
REVOKE ALL ON FUNCTION private.create_team_invitation(uuid,uuid,text,text,text,text),private.accept_team_invitation(uuid),private.revoke_team_invitation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.create_team_invitation(uuid,uuid,text,text,text,text),private.accept_team_invitation(uuid),private.revoke_team_invitation(uuid) TO authenticated;
CREATE FUNCTION public.create_team_invitation(account uuid,workspace uuid,email text,invitation_kind text,staff_role text,access_level text)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.create_team_invitation(account,workspace,email,invitation_kind,staff_role,access_level); $$;
CREATE FUNCTION public.accept_team_invitation(invitation_id uuid) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.accept_team_invitation(invitation_id); $$;
CREATE FUNCTION public.revoke_team_invitation(invitation_id uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.revoke_team_invitation(invitation_id); $$;
REVOKE ALL ON FUNCTION public.create_team_invitation(uuid,uuid,text,text,text,text),public.accept_team_invitation(uuid),public.revoke_team_invitation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_team_invitation(uuid,uuid,text,text,text,text),public.accept_team_invitation(uuid),public.revoke_team_invitation(uuid) TO authenticated;

CREATE FUNCTION private.remove_clinic_provider(account uuid,workspace uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE provider uuid; personal_account uuid;
BEGIN
  IF NOT private.billing_admin(account) THEN RAISE EXCEPTION 'Billing administrator required'; END IF;
  PERFORM 1 FROM public.billing_accounts WHERE id=account FOR UPDATE;
  SELECT owner_user_id INTO provider FROM public.physician_workspaces WHERE id=workspace AND billing_account_id=account FOR UPDATE;
  IF provider IS NULL OR provider=(SELECT auth.uid()) THEN RAISE EXCEPTION 'Cannot remove this provider'; END IF;
  SELECT id INTO personal_account FROM public.billing_accounts WHERE billing_admin_id=provider;
  IF personal_account IS NULL THEN RAISE EXCEPTION 'Provider personal billing account not found'; END IF;
  UPDATE public.physician_workspaces SET billing_account_id=personal_account WHERE id=workspace;
END;
$$;
REVOKE ALL ON FUNCTION private.remove_clinic_provider(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.remove_clinic_provider(uuid,uuid) TO authenticated;
CREATE FUNCTION public.remove_clinic_provider(account uuid,workspace uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.remove_clinic_provider(account,workspace); $$;
REVOKE ALL ON FUNCTION public.remove_clinic_provider(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_clinic_provider(uuid,uuid) TO authenticated;

COMMIT;
