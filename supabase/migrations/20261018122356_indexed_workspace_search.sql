BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated;
ALTER TABLE public.patient_files ADD COLUMN name_search text NOT NULL DEFAULT '';
CREATE FUNCTION private.set_file_search_text() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  NEW.name_search:=lower(extensions.unaccent('extensions.unaccent'::regdictionary,NEW.file_name));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.set_file_search_text() FROM PUBLIC;
CREATE TRIGGER file_search_text BEFORE INSERT OR UPDATE ON public.patient_files FOR EACH ROW EXECUTE FUNCTION private.set_file_search_text();
UPDATE public.patient_files SET name_search=lower(extensions.unaccent('extensions.unaccent'::regdictionary,file_name));
ALTER TABLE public.patient_files ADD COLUMN name_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig,name_search)) STORED;
CREATE INDEX patient_file_name_vector_idx ON public.patient_files USING gin(name_vector);
CREATE INDEX patient_file_name_partial_idx ON public.patient_files USING gin(name_search extensions.gin_trgm_ops);
CREATE FUNCTION public.search_workspace_files(workspace_id uuid,search_query text,page_number integer DEFAULT 1,page_size integer DEFAULT 20)
RETURNS SETOF public.patient_files LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE normalized text;
BEGIN
  IF page_number IS NULL OR page_number<1 OR page_number>100000 OR page_size IS NULL OR page_size<1 OR page_size>100 THEN RAISE EXCEPTION 'Invalid search pagination'; END IF;
  IF search_query IS NULL OR length(trim(search_query))<1 OR length(search_query)>100 THEN RAISE EXCEPTION 'Invalid search query'; END IF;
  normalized:=lower(extensions.unaccent('extensions.unaccent'::regdictionary,trim(search_query)));
  RETURN QUERY SELECT f.* FROM public.patient_files f JOIN public.patients p ON p.id=f.patient_id
    WHERE p.owner_id=workspace_id AND (
      f.name_vector @@ plainto_tsquery('simple'::regconfig,normalized) OR
      f.name_search LIKE '%'||replace(replace(replace(normalized,chr(92),chr(92)||chr(92)),'%',chr(92)||'%'),'_',chr(92)||'_')||'%'
    ) ORDER BY f.created_at DESC,f.id LIMIT page_size+1 OFFSET (page_number-1)*page_size;
END;
$$;
REVOKE ALL ON FUNCTION public.search_workspace_files(uuid,text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_workspace_files(uuid,text,integer,integer) TO authenticated;
COMMIT;
