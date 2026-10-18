BEGIN;
CREATE FUNCTION public.get_workspace_tier(workspace uuid) RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT CASE WHEN private.workspace_access(workspace) THEN private.workspace_tier(workspace) ELSE NULL END;
$$;
REVOKE ALL ON FUNCTION public.get_workspace_tier(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_workspace_tier(uuid) TO authenticated;
CREATE FUNCTION private.paid_note_access(patient uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT private.patient_access(patient,true) AND EXISTS(
    SELECT 1 FROM public.patients p WHERE p.id=patient AND private.workspace_tier(p.owner_id) IN ('pro','clinic')
  );
$$;
REVOKE ALL ON FUNCTION private.paid_note_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.paid_note_access(uuid) TO authenticated;
DROP POLICY note_insert ON public.appointment_notes;
DROP POLICY note_update ON public.appointment_notes;
CREATE POLICY note_insert ON public.appointment_notes FOR INSERT TO authenticated WITH CHECK(private.paid_note_access(patient_id) AND author_id=(SELECT auth.uid()));
CREATE POLICY note_update ON public.appointment_notes FOR UPDATE TO authenticated
USING(private.paid_note_access(patient_id) AND author_id=(SELECT auth.uid()))
WITH CHECK(private.paid_note_access(patient_id) AND author_id=(SELECT auth.uid()));
-- Retain historical read and author deletion on downgrade for data portability.
COMMIT;
