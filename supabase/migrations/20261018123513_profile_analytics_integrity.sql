BEGIN;
DROP POLICY "Anyone can insert analytics" ON public.profile_analytics;
DROP POLICY "Owners can view own analytics" ON public.profile_analytics;
CREATE POLICY workspace_analytics_read ON public.profile_analytics FOR SELECT TO authenticated USING(private.workspace_access(profile_id) AND private.workspace_tier(profile_id) IN ('pro','clinic'));
CREATE INDEX profile_analytics_window_idx ON public.profile_analytics(profile_id,viewed_at,link_clicked);
CREATE TABLE public.analytics_rate_limits (
  bucket_key text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL,
  PRIMARY KEY(bucket_key,window_start)
);
ALTER TABLE public.analytics_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.analytics_rate_limits FROM anon,authenticated;
GRANT ALL ON public.analytics_rate_limits TO service_role;
CREATE INDEX analytics_rate_limit_expiry_idx ON public.analytics_rate_limits(window_start);
CREATE FUNCTION private.record_profile_event(profile uuid,event_type text,link_type text,referral text,agent text,ip_hash text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE event_count integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.doctor_profiles WHERE id=profile AND is_published) THEN RETURN 'unavailable'; END IF;
  IF event_type NOT IN ('view','click') OR event_type IS NULL OR ip_hash IS NULL OR ip_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid analytics event'; END IF;
  IF event_type='click' AND (link_type IS NULL OR link_type NOT IN ('phone','email','whatsapp','website','contact','booking','link')) THEN RAISE EXCEPTION 'Invalid link type'; END IF;
  IF length(referral)>253 OR length(agent)>500 THEN RAISE EXCEPTION 'Invalid event metadata'; END IF;
  INSERT INTO public.analytics_rate_limits(bucket_key,window_start,hits) VALUES(ip_hash,date_trunc('minute',clock_timestamp()),1)
  ON CONFLICT(bucket_key,window_start) DO UPDATE SET hits=public.analytics_rate_limits.hits+1 RETURNING hits INTO event_count;
  IF event_count>30 THEN RETURN 'rate_limited'; END IF;
  INSERT INTO public.profile_analytics(profile_id,link_clicked,referral_source,user_agent,ip_hash)
  VALUES(profile,CASE WHEN event_type='click' THEN link_type ELSE NULL END,referral,agent,ip_hash);
  DELETE FROM public.analytics_rate_limits WHERE (bucket_key,window_start) IN (SELECT bucket_key,window_start FROM public.analytics_rate_limits WHERE window_start<now()-interval '2 hours' LIMIT 100);
  RETURN 'accepted';
END;
$$;
REVOKE ALL ON FUNCTION private.record_profile_event(uuid,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.record_profile_event(uuid,text,text,text,text,text) TO service_role;
CREATE FUNCTION public.record_profile_event(profile uuid,event_type text,link_type text,referral text,agent text,ip_hash text) RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.record_profile_event(profile,event_type,link_type,referral,agent,ip_hash); $$;
REVOKE ALL ON FUNCTION public.record_profile_event(uuid,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_profile_event(uuid,text,text,text,text,text) TO service_role;

CREATE FUNCTION public.get_profile_analytics(profile uuid,days integer DEFAULT 30) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE start_day date;views bigint;clicks bigint;daily jsonb;referrers jsonb;
BEGIN
  IF days IS NULL OR days<1 OR days>365 THEN RAISE EXCEPTION 'Invalid analytics period'; END IF;
  IF NOT private.workspace_access(profile) OR private.workspace_tier(profile) NOT IN ('pro','clinic') THEN RAISE EXCEPTION 'Analytics access denied'; END IF;
  start_day:=(now() AT TIME ZONE 'UTC')::date-days+1;
  SELECT count(*) FILTER(WHERE link_clicked IS NULL),count(*) FILTER(WHERE link_clicked IS NOT NULL) INTO views,clicks FROM public.profile_analytics WHERE profile_id=profile AND viewed_at>=start_day::timestamp AT TIME ZONE 'UTC';
  SELECT coalesce(jsonb_agg(to_jsonb(day_rows) ORDER BY day_rows.date),'[]') INTO daily FROM (
    SELECT to_char(d,'YYYY-MM-DD') AS date,count(a.id) FILTER(WHERE a.link_clicked IS NULL) AS views,count(a.id) FILTER(WHERE a.link_clicked IS NOT NULL) AS clicks
    FROM generate_series(start_day::timestamp,(now() AT TIME ZONE 'UTC')::date::timestamp,interval '1 day') d
    LEFT JOIN public.profile_analytics a ON a.profile_id=profile AND (a.viewed_at AT TIME ZONE 'UTC')::date=d::date
    GROUP BY d
  ) day_rows;
  SELECT coalesce(jsonb_agg(to_jsonb(source_rows) ORDER BY source_rows.count DESC,source_rows.source),'[]') INTO referrers FROM (
    SELECT coalesce(nullif(substring(referral_source FROM '^https?://([^/]+)'),''),nullif(referral_source,''),'Direct') AS source,count(*) AS count
    FROM public.profile_analytics WHERE profile_id=profile AND link_clicked IS NULL AND viewed_at>=start_day::timestamp AT TIME ZONE 'UTC'
    GROUP BY source ORDER BY count DESC,source LIMIT 10
  ) source_rows;
  RETURN jsonb_build_object('summary',jsonb_build_object('totalViews',views,'totalClicks',clicks,'ctr',CASE WHEN views=0 THEN 0 ELSE round(clicks::numeric/views*100,2) END),'daily',daily,'referrers',referrers);
END;
$$;
REVOKE ALL ON FUNCTION public.get_profile_analytics(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_analytics(uuid,integer) TO authenticated;
ALTER TABLE public.doctor_profiles ADD CONSTRAINT profile_slug_reserved CHECK(slug IS NULL OR slug NOT IN ('login','signup','reset-password','auth','patients','settings','analytics','search','api','admin','billing','team','uploads','files','workspaces','privacy','terms','support','help','www','dashboard')) NOT VALID;
ALTER TABLE public.doctor_profiles VALIDATE CONSTRAINT profile_slug_reserved;
COMMIT;
