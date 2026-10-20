BEGIN;
-- No patient FK: cleanup must survive deletion of the entire record tree.
CREATE TABLE public.storage_deletion_queue (
  storage_path text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.storage_deletion_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.storage_deletion_queue FROM anon,authenticated;
GRANT ALL ON public.storage_deletion_queue TO service_role;
CREATE FUNCTION private.queue_deleted_object() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO public.storage_deletion_queue(storage_path) VALUES(OLD.storage_path) ON CONFLICT DO NOTHING;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION private.queue_deleted_object() FROM PUBLIC;
CREATE TRIGGER file_storage_cleanup AFTER DELETE ON public.patient_files FOR EACH ROW EXECUTE FUNCTION private.queue_deleted_object();
CREATE TRIGGER reservation_storage_cleanup AFTER DELETE ON public.upload_reservations FOR EACH ROW EXECUTE FUNCTION private.queue_deleted_object();
-- Serialize an in-flight Storage INSERT with reservation deletion/cancellation.
-- The row lock lasts until the Storage transaction commits, before queueing cleanup.
CREATE OR REPLACE FUNCTION private.valid_upload_path(object_name text) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE reservation public.upload_reservations;
BEGIN
  SELECT * INTO reservation FROM public.upload_reservations WHERE storage_path=object_name FOR SHARE;
  RETURN reservation.id IS NOT NULL AND reservation.status='pending' AND reservation.expires_at>clock_timestamp()
    AND reservation.created_by=(SELECT auth.uid()) AND private.workspace_access(reservation.workspace_id,true);
END;
$$;
-- Recover objects whose finalized file was deleted before this migration.
INSERT INTO public.storage_deletion_queue(storage_path)
SELECT storage_path FROM public.upload_reservations WHERE status='finalized' AND file_id IS NULL
ON CONFLICT DO NOTHING;
CREATE FUNCTION private.queue_expired_uploads() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE removed integer;
BEGIN
  WITH expired AS (
    SELECT id FROM public.upload_reservations WHERE status<>'finalized' AND expires_at<clock_timestamp()
    ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED
  ) DELETE FROM public.upload_reservations WHERE id IN (SELECT id FROM expired);
  GET DIAGNOSTICS removed=ROW_COUNT;
  RETURN removed;
END;
$$;
REVOKE ALL ON FUNCTION private.queue_expired_uploads() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.queue_expired_uploads() TO service_role;
CREATE FUNCTION public.queue_expired_uploads() RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.queue_expired_uploads(); $$;
REVOKE ALL ON FUNCTION public.queue_expired_uploads() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_expired_uploads() TO service_role;
COMMIT;
