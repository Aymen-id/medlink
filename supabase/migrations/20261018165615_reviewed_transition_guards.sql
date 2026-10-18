BEGIN;
ALTER TABLE public.billing_accounts ADD COLUMN transfer_frozen boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION private.workspace_tier(workspace uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT coalesce((SELECT CASE WHEN s.tier='clinic' THEN 'clinic'
    WHEN s.tier='pro' AND w.owner_user_id=b.billing_admin_id THEN 'pro' ELSE 'free' END
    FROM public.physician_workspaces w JOIN public.billing_accounts b ON b.id=w.billing_account_id
    JOIN public.subscriptions s ON s.billing_account_id=b.id WHERE w.id=workspace
    AND s.status IN ('active','trialing') AND (s.current_period_end IS NULL OR s.current_period_end>now())),'free');
$$;

CREATE OR REPLACE FUNCTION private.finalize_patient_upload(upload_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE reservation public.upload_reservations; stored jsonb; file public.patient_files; account uuid; used_files integer;
BEGIN
  SELECT * INTO reservation FROM public.upload_reservations WHERE id=upload_id;
  IF reservation.id IS NULL OR reservation.created_by IS DISTINCT FROM (SELECT auth.uid()) OR NOT private.workspace_access(reservation.workspace_id,true) THEN RAISE EXCEPTION 'Upload access denied'; END IF;
  SELECT billing_account_id INTO account FROM public.physician_workspaces WHERE id=reservation.workspace_id;
  -- Billing changes lock the account before moving/locking workspaces. Use the
  -- same order so a concurrent downgrade cannot commit between cap check/insert.
  PERFORM 1 FROM public.billing_accounts WHERE id=account FOR SHARE;
  PERFORM 1 FROM public.physician_workspaces WHERE id=reservation.workspace_id AND billing_account_id=account FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workspace billing changed; retry finalization'; END IF;
  SELECT * INTO reservation FROM public.upload_reservations WHERE id=upload_id FOR UPDATE;
  IF reservation.id IS NULL OR reservation.created_by IS DISTINCT FROM (SELECT auth.uid()) OR NOT private.workspace_access(reservation.workspace_id,true) THEN RAISE EXCEPTION 'Upload access denied'; END IF;
  IF reservation.status='finalized' THEN SELECT * INTO file FROM public.patient_files WHERE id=reservation.file_id; RETURN to_jsonb(file); END IF;
  IF reservation.status<>'pending' OR reservation.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Upload reservation expired or canceled'; END IF;
  IF private.workspace_tier(reservation.workspace_id)='free' THEN
    SELECT count(*) INTO used_files FROM public.patient_files f JOIN public.patients p ON p.id=f.patient_id WHERE p.owner_id=reservation.workspace_id;
    IF used_files>=10 THEN RAISE EXCEPTION 'Free file limit reached (10). Upgrade to Pro for more files'; END IF;
  END IF;
  SELECT metadata INTO stored FROM storage.objects WHERE bucket_id='patient-files' AND name=reservation.storage_path;
  IF stored IS NULL OR (stored->>'size')::bigint IS DISTINCT FROM reservation.size_bytes OR stored->>'mimetype' IS DISTINCT FROM reservation.mime_type THEN RAISE EXCEPTION 'Uploaded object is missing or does not match reserved metadata'; END IF;
  INSERT INTO public.patient_files(patient_id,folder_id,file_name,storage_path,mime_type,size_bytes,tags)
    VALUES(reservation.patient_id,reservation.folder_id,reservation.file_name,reservation.storage_path,reservation.mime_type,reservation.size_bytes,reservation.tags) RETURNING * INTO file;
  UPDATE public.upload_reservations SET status='finalized',file_id=file.id WHERE id=upload_id;
  RETURN to_jsonb(file);
END;
$$;

CREATE FUNCTION private.assert_billing_purchase_allowed(account uuid,token uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.billing_accounts b JOIN public.physician_workspaces w ON w.billing_account_id=b.id AND w.owner_user_id=b.billing_admin_id
    WHERE b.id=account AND b.operation_token=token AND b.operation_expires_at>clock_timestamp() AND NOT b.transfer_frozen)
    THEN RAISE EXCEPTION 'Personal billing is closed for Clinic transfer or workspace ownership changed'; END IF;
END;
$$;
CREATE FUNCTION private.freeze_billing_for_transfer(account uuid,token uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF (SELECT count(*) FROM public.physician_workspaces WHERE billing_account_id=account)<>1
    OR NOT EXISTS(SELECT 1 FROM public.physician_workspaces w JOIN public.billing_accounts b ON b.id=w.billing_account_id WHERE b.id=account AND w.owner_user_id=b.billing_admin_id)
    THEN RAISE EXCEPTION 'Resolve the existing Clinic billing account before joining'; END IF;
  UPDATE public.billing_accounts SET transfer_frozen=true WHERE id=account AND operation_token=token AND operation_expires_at>clock_timestamp();
  IF NOT FOUND THEN RAISE EXCEPTION 'Billing operation expired'; END IF;
  -- Service caller verified canonical Stripe state and expired every open
  -- Checkout while holding this lease. Clear delayed local subscription state.
  UPDATE public.subscriptions SET tier='free',status='active',stripe_subscription_id=NULL,current_period_end=NULL,billing_interval=NULL,stripe_price_id=NULL WHERE billing_account_id=account;
END;
$$;
REVOKE ALL ON FUNCTION private.assert_billing_purchase_allowed(uuid,uuid),private.freeze_billing_for_transfer(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.assert_billing_purchase_allowed(uuid,uuid),private.freeze_billing_for_transfer(uuid,uuid) TO service_role;
CREATE FUNCTION public.assert_billing_purchase_allowed(account uuid,token uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.assert_billing_purchase_allowed(account,token); $$;
CREATE FUNCTION public.freeze_billing_for_transfer(account uuid,token uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.freeze_billing_for_transfer(account,token); $$;
REVOKE ALL ON FUNCTION public.assert_billing_purchase_allowed(uuid,uuid),public.freeze_billing_for_transfer(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_billing_purchase_allowed(uuid,uuid),public.freeze_billing_for_transfer(uuid,uuid) TO service_role;

CREATE FUNCTION private.unfreeze_personal_billing(user_id uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  UPDATE public.billing_accounts b SET transfer_frozen=false WHERE b.billing_admin_id=user_id
    AND (b.operation_token IS NULL OR b.operation_expires_at<=clock_timestamp())
    AND EXISTS(SELECT 1 FROM public.physician_workspaces w WHERE w.billing_account_id=b.id AND w.owner_user_id=user_id);
$$;
REVOKE ALL ON FUNCTION private.unfreeze_personal_billing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.unfreeze_personal_billing(uuid) TO service_role;
CREATE FUNCTION public.unfreeze_personal_billing(user_id uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.unfreeze_personal_billing(user_id); $$;
REVOKE ALL ON FUNCTION public.unfreeze_personal_billing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unfreeze_personal_billing(uuid) TO service_role;

CREATE OR REPLACE FUNCTION private.accept_team_invitation(invitation_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE invitation public.team_invitations; previous_account uuid; target uuid; personal public.billing_accounts;
BEGIN
  SELECT * INTO invitation FROM public.team_invitations WHERE id=invitation_id;
  IF invitation.id IS NULL THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF invitation.invited_email IS DISTINCT FROM private.current_email() THEN RAISE EXCEPTION 'This invitation requires its confirmed recipient email'; END IF;
  IF invitation.kind='provider' THEN SELECT billing_account_id INTO previous_account FROM public.physician_workspaces WHERE owner_user_id=(SELECT auth.uid()); END IF;
  -- Consistent ordering for transfers between accounts, including cross-invites.
  PERFORM 1 FROM public.billing_accounts WHERE id IN (invitation.billing_account_id,previous_account) ORDER BY id FOR UPDATE;
  SELECT * INTO invitation FROM public.team_invitations WHERE id=invitation_id FOR UPDATE;
  IF invitation.invited_email IS DISTINCT FROM private.current_email() OR invitation.status<>'pending' OR invitation.expires_at<=now() THEN RAISE EXCEPTION 'Invitation expired or no longer pending'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.subscriptions s WHERE s.billing_account_id=invitation.billing_account_id AND s.tier='clinic' AND s.status IN ('active','trialing') AND (s.current_period_end IS NULL OR s.current_period_end>now())) THEN RAISE EXCEPTION 'Active Clinic subscription required'; END IF;
  IF invitation.kind='provider' THEN
    SELECT id INTO target FROM public.physician_workspaces WHERE owner_user_id=(SELECT auth.uid()) AND billing_account_id=previous_account FOR UPDATE;
    IF target IS NULL OR previous_account=invitation.billing_account_id THEN RAISE EXCEPTION 'A separate physician workspace is required'; END IF;
    SELECT * INTO personal FROM public.billing_accounts WHERE id=previous_account;
    IF personal.billing_admin_id IS DISTINCT FROM (SELECT auth.uid()) OR EXISTS(SELECT 1 FROM public.physician_workspaces WHERE billing_account_id=previous_account AND id<>target) THEN RAISE EXCEPTION 'Resolve the existing Clinic billing account before joining'; END IF;
    IF personal.operation_token IS NOT NULL AND personal.operation_expires_at>clock_timestamp() THEN RAISE EXCEPTION 'Personal billing operation is busy; retry shortly'; END IF;
    IF personal.stripe_customer_id IS NOT NULL AND NOT personal.transfer_frozen THEN RAISE EXCEPTION 'Personal billing must be verified and closed before Clinic transfer'; END IF;
    IF EXISTS(SELECT 1 FROM public.subscriptions WHERE billing_account_id=previous_account AND stripe_subscription_id IS NOT NULL AND status NOT IN ('canceled','incomplete_expired'))
      OR EXISTS(SELECT 1 FROM public.subscriptions WHERE billing_account_id=previous_account AND tier<>'free' AND status NOT IN ('canceled','incomplete_expired')) THEN RAISE EXCEPTION 'Resolve the existing paid subscription before joining this Clinic'; END IF;
    IF (SELECT count(*) FROM public.physician_workspaces WHERE billing_account_id=invitation.billing_account_id)>=8 THEN RAISE EXCEPTION 'No provider seat available'; END IF;
    UPDATE public.billing_accounts SET transfer_frozen=true WHERE id=previous_account;
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

CREATE FUNCTION private.restore_personal_billing() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  UPDATE public.billing_accounts SET transfer_frozen=false WHERE id=NEW.billing_account_id AND billing_admin_id=NEW.owner_user_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER restore_personal_billing AFTER UPDATE OF billing_account_id ON public.physician_workspaces FOR EACH ROW EXECUTE FUNCTION private.restore_personal_billing();
CREATE FUNCTION private.release_uncovered_providers() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE provider record; admin_id uuid;
BEGIN
  IF NEW.tier='clinic' AND NEW.status IN ('active','trialing') AND (NEW.current_period_end IS NULL OR NEW.current_period_end>now()) THEN RETURN NEW; END IF;
  SELECT billing_admin_id INTO admin_id FROM public.billing_accounts WHERE id=NEW.billing_account_id;
  FOR provider IN SELECT w.id,b.id AS personal_account FROM public.physician_workspaces w JOIN public.billing_accounts b ON b.billing_admin_id=w.owner_user_id
    WHERE w.billing_account_id=NEW.billing_account_id AND w.owner_user_id<>admin_id ORDER BY w.id FOR UPDATE OF w LOOP
    UPDATE public.physician_workspaces SET billing_account_id=provider.personal_account WHERE id=provider.id;
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER release_uncovered_providers AFTER INSERT OR UPDATE OF tier,status,current_period_end ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION private.release_uncovered_providers();
REVOKE ALL ON FUNCTION private.restore_personal_billing(),private.release_uncovered_providers() FROM PUBLIC;
COMMIT;
