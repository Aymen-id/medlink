BEGIN;
ALTER TABLE public.billing_accounts ADD COLUMN stripe_customer_id text UNIQUE;
ALTER TABLE public.billing_accounts ADD COLUMN operation_token uuid;
ALTER TABLE public.billing_accounts ADD COLUMN operation_expires_at timestamptz;
UPDATE public.billing_accounts b SET stripe_customer_id=s.stripe_customer_id FROM public.subscriptions s WHERE s.billing_account_id=b.id AND nullif(s.stripe_customer_id,'') IS NOT NULL;
ALTER TABLE public.subscriptions ADD COLUMN billing_interval text CHECK(billing_interval IN ('monthly','annual'));
ALTER TABLE public.subscriptions ADD COLUMN stripe_price_id text;
CREATE TABLE public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  billing_account_id uuid NOT NULL REFERENCES public.billing_accounts(id),
  processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_webhook_events FROM anon,authenticated;
GRANT ALL ON public.stripe_webhook_events TO service_role;
DROP POLICY "Owners can view own subscription" ON public.subscriptions;
CREATE POLICY billing_admin_subscription_read ON public.subscriptions FOR SELECT TO authenticated USING(private.billing_admin(billing_account_id));

CREATE FUNCTION private.acquire_billing_operation(account uuid,token uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE acquired uuid;
BEGIN
  UPDATE public.billing_accounts SET operation_token=token,operation_expires_at=clock_timestamp()+interval '120 seconds'
    WHERE id=account AND (operation_token=token OR operation_token IS NULL OR operation_expires_at<clock_timestamp()) RETURNING id INTO acquired;
  RETURN acquired IS NOT NULL;
END;
$$;
CREATE FUNCTION private.release_billing_operation(account uuid,token uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  UPDATE public.billing_accounts SET operation_token=NULL,operation_expires_at=NULL WHERE id=account AND operation_token=token;
$$;
CREATE FUNCTION private.bind_billing_customer(account uuid,token uuid,customer text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  UPDATE public.billing_accounts SET stripe_customer_id=customer WHERE id=account AND operation_token=token AND operation_expires_at>clock_timestamp()
    AND (stripe_customer_id IS NULL OR stripe_customer_id=customer);
  IF NOT FOUND THEN RAISE EXCEPTION 'Billing operation expired or customer mismatch'; END IF;
END;
$$;
CREATE FUNCTION private.apply_billing_snapshot(account uuid,token uuid,event_id text,snapshot jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE billing public.billing_accounts;
BEGIN
  SELECT * INTO billing FROM public.billing_accounts WHERE id=account FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.stripe_webhook_events e WHERE e.event_id=apply_billing_snapshot.event_id) THEN RETURN false; END IF;
  IF billing.id IS NULL OR billing.operation_token IS DISTINCT FROM token OR billing.operation_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Billing operation expired'; END IF;
  IF billing.stripe_customer_id IS DISTINCT FROM snapshot->>'customerId' THEN RAISE EXCEPTION 'Billing customer mismatch'; END IF;
  IF snapshot->>'tier' NOT IN ('free','pro','clinic') OR snapshot->>'status' NOT IN ('active','trialing','past_due','canceled','unpaid','incomplete','incomplete_expired','paused') THEN RAISE EXCEPTION 'Invalid billing snapshot'; END IF;
  INSERT INTO public.subscriptions(user_id,billing_account_id,stripe_customer_id,stripe_subscription_id,tier,status,current_period_end,billing_interval,stripe_price_id)
  VALUES(billing.billing_admin_id,account,snapshot->>'customerId',nullif(snapshot->>'subscriptionId',''),snapshot->>'tier',snapshot->>'status',nullif(snapshot->>'periodEnd','')::timestamptz,nullif(snapshot->>'interval',''),nullif(snapshot->>'priceId',''))
  ON CONFLICT(billing_account_id) DO UPDATE SET stripe_customer_id=EXCLUDED.stripe_customer_id,stripe_subscription_id=EXCLUDED.stripe_subscription_id,tier=EXCLUDED.tier,status=EXCLUDED.status,current_period_end=EXCLUDED.current_period_end,billing_interval=EXCLUDED.billing_interval,stripe_price_id=EXCLUDED.stripe_price_id;
  INSERT INTO public.stripe_webhook_events(event_id,billing_account_id) VALUES(event_id,account);
  UPDATE public.billing_accounts SET operation_token=NULL,operation_expires_at=NULL WHERE id=account;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION private.acquire_billing_operation(uuid,uuid),private.release_billing_operation(uuid,uuid),private.bind_billing_customer(uuid,uuid,text),private.apply_billing_snapshot(uuid,uuid,text,jsonb) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.acquire_billing_operation(uuid,uuid),private.release_billing_operation(uuid,uuid),private.bind_billing_customer(uuid,uuid,text),private.apply_billing_snapshot(uuid,uuid,text,jsonb) TO service_role;
CREATE FUNCTION public.acquire_billing_operation(account uuid,token uuid) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.acquire_billing_operation(account,token); $$;
CREATE FUNCTION public.release_billing_operation(account uuid,token uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.release_billing_operation(account,token); $$;
CREATE FUNCTION public.bind_billing_customer(account uuid,token uuid,customer text) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.bind_billing_customer(account,token,customer); $$;
CREATE FUNCTION public.apply_billing_snapshot(account uuid,token uuid,event_id text,snapshot jsonb) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.apply_billing_snapshot(account,token,event_id,snapshot); $$;
REVOKE ALL ON FUNCTION public.acquire_billing_operation(uuid,uuid),public.release_billing_operation(uuid,uuid),public.bind_billing_customer(uuid,uuid,text),public.apply_billing_snapshot(uuid,uuid,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_billing_operation(uuid,uuid),public.release_billing_operation(uuid,uuid),public.bind_billing_customer(uuid,uuid,text),public.apply_billing_snapshot(uuid,uuid,text,jsonb) TO service_role;
COMMIT;
