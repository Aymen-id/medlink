BEGIN;

-- Replace permissive legacy policies rather than combining them with stricter ones.
DO $$ DECLARE policy record;
BEGIN
  FOR policy IN SELECT schemaname,tablename,policyname FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('patients','folders','patient_files','appointment_notes')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I',policy.policyname,policy.schemaname,policy.tablename);
  END LOOP;
END $$;

CREATE FUNCTION private.patient_access(patient uuid, require_edit boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.patients p WHERE p.id=patient AND private.workspace_access(p.owner_id,require_edit));
$$;
REVOKE ALL ON FUNCTION private.patient_access(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.patient_access(uuid,boolean) TO authenticated;

CREATE POLICY patient_read ON public.patients FOR SELECT TO authenticated USING(private.workspace_access(owner_id));
CREATE POLICY patient_insert ON public.patients FOR INSERT TO authenticated WITH CHECK(private.workspace_access(owner_id,true));
CREATE POLICY patient_update ON public.patients FOR UPDATE TO authenticated USING(private.workspace_access(owner_id,true)) WITH CHECK(private.workspace_access(owner_id,true));
CREATE POLICY patient_delete ON public.patients FOR DELETE TO authenticated USING(private.workspace_access(owner_id,true));

CREATE POLICY folder_read ON public.folders FOR SELECT TO authenticated USING(private.patient_access(patient_id));
CREATE POLICY folder_insert ON public.folders FOR INSERT TO authenticated WITH CHECK(private.patient_access(patient_id,true));
CREATE POLICY folder_update ON public.folders FOR UPDATE TO authenticated USING(private.patient_access(patient_id,true)) WITH CHECK(private.patient_access(patient_id,true));
CREATE POLICY folder_delete ON public.folders FOR DELETE TO authenticated USING(private.patient_access(patient_id,true));

CREATE POLICY file_read ON public.patient_files FOR SELECT TO authenticated USING(private.patient_access(patient_id));
CREATE POLICY file_insert ON public.patient_files FOR INSERT TO authenticated WITH CHECK(private.patient_access(patient_id,true));
CREATE POLICY file_update ON public.patient_files FOR UPDATE TO authenticated USING(private.patient_access(patient_id,true)) WITH CHECK(private.patient_access(patient_id,true));
CREATE POLICY file_delete ON public.patient_files FOR DELETE TO authenticated USING(private.patient_access(patient_id,true));

CREATE POLICY note_read ON public.appointment_notes FOR SELECT TO authenticated USING(private.patient_access(patient_id));
CREATE POLICY note_insert ON public.appointment_notes FOR INSERT TO authenticated WITH CHECK(private.patient_access(patient_id,true) AND author_id=(SELECT auth.uid()));
CREATE POLICY note_update ON public.appointment_notes FOR UPDATE TO authenticated
USING(private.patient_access(patient_id,true) AND author_id=(SELECT auth.uid()))
WITH CHECK(private.patient_access(patient_id,true) AND author_id=(SELECT auth.uid()));
CREATE POLICY note_delete ON public.appointment_notes FOR DELETE TO authenticated USING(private.patient_access(patient_id,true) AND author_id=(SELECT auth.uid()));

CREATE FUNCTION private.enforce_patient_consistency()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE workspace uuid;
BEGIN
  IF TG_TABLE_NAME='patients' THEN
    IF TG_OP='UPDATE' AND NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN RAISE EXCEPTION 'Patient workspace cannot change'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='UPDATE' AND NEW.patient_id IS DISTINCT FROM OLD.patient_id THEN RAISE EXCEPTION 'Patient association cannot change'; END IF;
  -- Serialize hierarchy checks for one patient so concurrent moves cannot create cycles.
  PERFORM 1 FROM public.patients WHERE id=NEW.patient_id FOR UPDATE;
  IF TG_TABLE_NAME='folders' THEN
    IF NEW.parent_id IS NOT NULL THEN
    IF NEW.parent_id=NEW.id OR NOT EXISTS(SELECT 1 FROM public.folders f WHERE f.id=NEW.parent_id AND f.patient_id=NEW.patient_id) THEN
      RAISE EXCEPTION 'Parent folder must belong to this patient';
    END IF;
    IF EXISTS(WITH RECURSIVE descendants AS (
      SELECT id FROM public.folders WHERE parent_id=NEW.id
      UNION SELECT f.id FROM public.folders f JOIN descendants d ON f.parent_id=d.id
    ) SELECT 1 FROM descendants WHERE id=NEW.parent_id) THEN RAISE EXCEPTION 'Folder cycle is not allowed'; END IF;
    END IF;
  ELSIF TG_TABLE_NAME='patient_files' THEN
    IF NEW.folder_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.folders f WHERE f.id=NEW.folder_id AND f.patient_id=NEW.patient_id) THEN
      RAISE EXCEPTION 'Folder must belong to this patient';
    END IF;
    SELECT owner_id INTO workspace FROM public.patients WHERE id=NEW.patient_id;
    IF split_part(NEW.storage_path,'/',1)<>workspace::text OR split_part(NEW.storage_path,'/',2)<>NEW.patient_id::text THEN
      RAISE EXCEPTION 'Storage path must match patient workspace';
    END IF;
    IF TG_OP='UPDATE' AND NEW.storage_path IS DISTINCT FROM OLD.storage_path THEN RAISE EXCEPTION 'Storage path cannot change'; END IF;
  ELSIF TG_TABLE_NAME='appointment_notes' THEN
    IF TG_OP='UPDATE' AND NEW.author_id IS DISTINCT FROM OLD.author_id THEN RAISE EXCEPTION 'Note author cannot change'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enforce_patient_consistency() FROM PUBLIC;
CREATE TRIGGER patient_consistency BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION private.enforce_patient_consistency();
CREATE TRIGGER folder_consistency BEFORE INSERT OR UPDATE ON public.folders FOR EACH ROW EXECUTE FUNCTION private.enforce_patient_consistency();
CREATE TRIGGER file_consistency BEFORE INSERT OR UPDATE ON public.patient_files FOR EACH ROW EXECUTE FUNCTION private.enforce_patient_consistency();
CREATE TRIGGER note_consistency BEFORE UPDATE ON public.appointment_notes FOR EACH ROW EXECUTE FUNCTION private.enforce_patient_consistency();

-- Bucket privacy is reproducible. Provider encryption at rest requires hosted evidence.
INSERT INTO storage.buckets(id,name,public,file_size_limit)
VALUES('patient-files','patient-files',false,52428800)
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=EXCLUDED.file_size_limit;

CREATE FUNCTION private.storage_access(object_name text, require_edit boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE workspace uuid; patient uuid;
BEGIN
  BEGIN
    workspace:=split_part(object_name,'/',1)::uuid;
    patient:=split_part(object_name,'/',2)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RETURN false;
  END;
  RETURN EXISTS(SELECT 1 FROM public.patients p WHERE p.id=patient AND p.owner_id=workspace)
    AND private.workspace_access(workspace,require_edit);
END;
$$;
CREATE FUNCTION private.registered_file(object_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.patient_files f WHERE f.storage_path=object_name AND private.patient_access(f.patient_id));
$$;
REVOKE ALL ON FUNCTION private.storage_access(text,boolean),private.registered_file(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.storage_access(text,boolean),private.registered_file(text) TO authenticated;
CREATE POLICY patient_object_read ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='patient-files' AND private.storage_access(name) AND private.registered_file(name));
CREATE POLICY patient_object_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='patient-files' AND private.storage_access(name,true));
CREATE POLICY patient_object_delete ON storage.objects FOR DELETE TO authenticated
USING(bucket_id='patient-files' AND private.storage_access(name,true));
-- No UPDATE policy: objects are immutable; replacements must use new paths.

REVOKE ALL ON FUNCTION public.is_staff_for_owner(uuid),public.get_patient_owner(uuid) FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.handle_new_user() SET search_path='';
ALTER FUNCTION public.set_updated_at() SET search_path='';

COMMIT;
