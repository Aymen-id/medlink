BEGIN;
CREATE TABLE public.upload_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.physician_workspaces(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK(size_bytes>0 AND size_bytes<=52428800),
  tags text[] NOT NULL DEFAULT '{}',
  storage_path text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','finalized','canceled')),
  file_id uuid REFERENCES public.patient_files(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',
  created_at timestamptz NOT NULL DEFAULT now(),
  cleaned_at timestamptz
);
CREATE INDEX upload_reservation_quota_idx ON public.upload_reservations(workspace_id,status,expires_at);
ALTER TABLE public.upload_reservations ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.upload_reservations TO authenticated;
CREATE POLICY reservation_read ON public.upload_reservations FOR SELECT TO authenticated USING(created_by=(SELECT auth.uid()) AND private.workspace_access(workspace_id,true));
DROP POLICY file_insert ON public.patient_files;
DROP POLICY patient_object_insert ON storage.objects;
-- SELECT also permits minting bearer URLs in the Storage API. Keep reads behind
-- the authenticated application endpoint so staff revocation applies per request.
DROP POLICY patient_object_read ON storage.objects;

CREATE FUNCTION private.reserve_patient_upload(patient uuid,folder uuid,filename text,mime text,bytes bigint,file_tags text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE workspace uuid; upload_id uuid:=gen_random_uuid(); object_path text; used_files integer;
BEGIN
  IF NOT private.patient_access(patient,true) THEN RAISE EXCEPTION 'Patient upload access denied'; END IF;
  SELECT owner_id INTO workspace FROM public.patients WHERE id=patient;
  PERFORM 1 FROM public.physician_workspaces WHERE id=workspace FOR UPDATE;
  IF bytes<=0 OR bytes>52428800 OR bytes IS NULL THEN RAISE EXCEPTION 'File must be between 1 byte and 50 MiB'; END IF;
  IF filename IS NULL OR length(trim(filename))=0 OR length(filename)>255 OR filename ~ '[/\\[:cntrl:]]' THEN RAISE EXCEPTION 'Invalid filename'; END IF;
  IF mime NOT IN ('application/pdf','image/jpeg','image/png','image/webp','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document') OR mime IS NULL THEN RAISE EXCEPTION 'Unsupported document type'; END IF;
  IF cardinality(file_tags)>20 OR EXISTS(SELECT 1 FROM unnest(file_tags) tag WHERE length(tag)>50 OR length(trim(tag))=0) THEN RAISE EXCEPTION 'Invalid file tags'; END IF;
  IF folder IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.folders WHERE id=folder AND patient_id=patient) THEN RAISE EXCEPTION 'Folder must belong to patient'; END IF;
  IF private.workspace_tier(workspace)='free' THEN
    SELECT (SELECT count(*) FROM public.patient_files f JOIN public.patients p ON p.id=f.patient_id WHERE p.owner_id=workspace)+
      (SELECT count(*) FROM public.upload_reservations r WHERE r.workspace_id=workspace AND r.status='pending' AND r.expires_at>now()) INTO used_files;
    IF used_files>=10 THEN RAISE EXCEPTION 'Free file limit reached (10). Upgrade to Pro for more files'; END IF;
  END IF;
  object_path:=workspace::text||'/'||patient::text||'/'||upload_id::text;
  INSERT INTO public.upload_reservations(id,workspace_id,patient_id,folder_id,file_name,mime_type,size_bytes,tags,storage_path,created_by)
  VALUES(upload_id,workspace,patient,folder,filename,mime,bytes,coalesce(file_tags,'{}'),object_path,(SELECT auth.uid()));
  RETURN jsonb_build_object('id',upload_id,'storage_path',object_path);
END;
$$;
CREATE FUNCTION private.valid_upload_path(object_name text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.upload_reservations r WHERE r.storage_path=object_name AND r.status='pending' AND r.expires_at>now()
    AND r.created_by=(SELECT auth.uid()) AND private.workspace_access(r.workspace_id,true));
$$;
REVOKE ALL ON FUNCTION private.valid_upload_path(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.valid_upload_path(text) TO authenticated;
CREATE POLICY patient_object_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='patient-files' AND private.valid_upload_path(name));

CREATE FUNCTION private.finalize_patient_upload(upload_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE reservation public.upload_reservations; stored jsonb; file public.patient_files;
BEGIN
  SELECT * INTO reservation FROM public.upload_reservations WHERE id=upload_id FOR UPDATE;
  IF reservation.id IS NULL OR reservation.created_by IS DISTINCT FROM (SELECT auth.uid()) OR NOT private.workspace_access(reservation.workspace_id,true) THEN RAISE EXCEPTION 'Upload access denied'; END IF;
  IF reservation.status='finalized' THEN SELECT * INTO file FROM public.patient_files WHERE id=reservation.file_id; RETURN to_jsonb(file); END IF;
  IF reservation.status<>'pending' OR reservation.expires_at<=now() THEN RAISE EXCEPTION 'Upload reservation expired or canceled'; END IF;
  PERFORM 1 FROM public.physician_workspaces WHERE id=reservation.workspace_id FOR UPDATE;
  IF reservation.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Upload reservation expired'; END IF;
  SELECT metadata INTO stored FROM storage.objects WHERE bucket_id='patient-files' AND name=reservation.storage_path;
  IF stored IS NULL OR (stored->>'size')::bigint IS DISTINCT FROM reservation.size_bytes OR stored->>'mimetype' IS DISTINCT FROM reservation.mime_type THEN RAISE EXCEPTION 'Uploaded object is missing or does not match reserved metadata'; END IF;
  INSERT INTO public.patient_files(patient_id,folder_id,file_name,storage_path,mime_type,size_bytes,tags)
  VALUES(reservation.patient_id,reservation.folder_id,reservation.file_name,reservation.storage_path,reservation.mime_type,reservation.size_bytes,reservation.tags) RETURNING * INTO file;
  UPDATE public.upload_reservations SET status='finalized',file_id=file.id WHERE id=upload_id;
  RETURN to_jsonb(file);
END;
$$;
CREATE FUNCTION private.cancel_patient_upload(upload_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE reservation public.upload_reservations;
BEGIN
  SELECT * INTO reservation FROM public.upload_reservations WHERE id=upload_id FOR UPDATE;
  IF reservation.created_by IS DISTINCT FROM (SELECT auth.uid()) OR NOT private.workspace_access(reservation.workspace_id,true) THEN RAISE EXCEPTION 'Upload access denied'; END IF;
  IF reservation.status='finalized' THEN RAISE EXCEPTION 'Finalized uploads cannot be canceled'; END IF;
  UPDATE public.upload_reservations SET status='canceled' WHERE id=upload_id;
  RETURN reservation.storage_path;
END;
$$;
REVOKE ALL ON FUNCTION private.reserve_patient_upload(uuid,uuid,text,text,bigint,text[]),private.finalize_patient_upload(uuid),private.cancel_patient_upload(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.reserve_patient_upload(uuid,uuid,text,text,bigint,text[]),private.finalize_patient_upload(uuid),private.cancel_patient_upload(uuid) TO authenticated;
CREATE FUNCTION public.reserve_patient_upload(patient uuid,folder uuid,filename text,mime text,bytes bigint,file_tags text[])
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.reserve_patient_upload(patient,folder,filename,mime,bytes,file_tags); $$;
CREATE FUNCTION public.finalize_patient_upload(upload_id uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.finalize_patient_upload(upload_id); $$;
CREATE FUNCTION public.cancel_patient_upload(upload_id uuid) RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.cancel_patient_upload(upload_id); $$;
REVOKE ALL ON FUNCTION public.reserve_patient_upload(uuid,uuid,text,text,bigint,text[]),public.finalize_patient_upload(uuid),public.cancel_patient_upload(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_patient_upload(uuid,uuid,text,text,bigint,text[]),public.finalize_patient_upload(uuid),public.cancel_patient_upload(uuid) TO authenticated;
COMMIT;
