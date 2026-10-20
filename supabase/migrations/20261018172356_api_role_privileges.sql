BEGIN;
-- RLS does not constrain TRUNCATE; remove inherited hosted default grants.
REVOKE TRUNCATE,REFERENCES,TRIGGER ON ALL TABLES IN SCHEMA public FROM anon,authenticated;
REVOKE TRUNCATE,REFERENCES,TRIGGER ON storage.objects FROM anon,authenticated;
REVOKE ALL ON public.patients,public.folders,public.patient_files,public.appointment_notes,
  public.subscriptions,public.staff_access,public.profile_analytics,public.billing_accounts,
  public.physician_workspaces,public.workspace_memberships,public.team_invitations,
  public.upload_reservations,public.storage_deletion_queue,public.analytics_rate_limits,public.stripe_webhook_events FROM anon;
REVOKE INSERT,UPDATE,DELETE ON public.billing_accounts,public.physician_workspaces,
  public.workspace_memberships,public.team_invitations,public.upload_reservations,
  public.subscriptions FROM authenticated;
-- Public profile reads remain allowed, with the published-profile row policy.
GRANT SELECT ON public.doctor_profiles TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon,authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.get_patient_owner(uuid) SET search_path='';
ALTER FUNCTION public.is_staff_for_owner(uuid) SET search_path='';
DO $$ BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC,anon,authenticated';
  END IF;
END $$;
COMMIT;
