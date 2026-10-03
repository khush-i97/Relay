create or replace function public.get_summary(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'totalXp', p.total_xp,
    'level', 1 + floor(p.total_xp / 1000.0)::integer,
    'xpIntoLevel', p.total_xp % 1000,
    'xpNeededForNextLevel', 1000 - (p.total_xp % 1000),
    'balanceCents', coalesce(sum(w.delta_cents), 0)::integer,
    'rewardFunding', 'platform',
    'verificationMode', 'demo'
  )
  from public.profiles p
  left join public.wallet_transactions w on w.user_id = p.user_id
  where p.user_id = p_user_id
  group by p.user_id, p.total_xp;
$$;

create or replace function public.create_or_resume_demo_session(
  p_token_hash text,
  p_session_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_session public.demo_sessions%rowtype;
  v_user_id uuid;
begin
  select * into v_session
  from public.demo_sessions
  where token_hash = p_token_hash and expires_at > p_now;

  if found then
    return jsonb_build_object(
      'sessionId', v_session.session_id,
      'userId', v_session.user_id,
      'expiresAt', v_session.expires_at,
      'summary', public.get_summary(v_session.user_id)
    );
  end if;

  delete from public.demo_sessions where token_hash = p_token_hash;
  v_user_id := gen_random_uuid();
  insert into public.profiles (user_id) values (v_user_id);
  insert into public.demo_sessions (token_hash, session_id, user_id, expires_at)
  values (p_token_hash, p_session_id, v_user_id, p_now + interval '24 hours')
  returning * into v_session;

  return jsonb_build_object(
    'sessionId', v_session.session_id,
    'userId', v_user_id,
    'expiresAt', v_session.expires_at,
    'summary', public.get_summary(v_user_id)
  );
end;
$$;

create or replace function public.resolve_demo_session(p_token_hash text, p_now timestamptz default now())
returns table (session_id uuid, user_id uuid, expires_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.session_id, s.user_id, s.expires_at
  from public.demo_sessions s
  where s.token_hash = p_token_hash and s.expires_at > p_now;
$$;

create or replace function public.get_idempotency_replay(
  p_user_id uuid,
  p_operation text,
  p_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_record public.idempotency_records%rowtype;
begin
  select * into v_record from public.idempotency_records
  where user_id = p_user_id and operation = p_operation and key = p_key;
  if not found then return null; end if;
  if v_record.request_hash <> p_request_hash then
    return jsonb_build_object('ok', false, 'status', 409, 'error', jsonb_build_object('code', 'IDEMPOTENCY_CONFLICT', 'message', 'Idempotency key was reused with different input', 'retryable', false));
  end if;
  return jsonb_build_object('ok', true, 'status', v_record.response_status, 'response', v_record.response_json);
end;
$$;

create or replace function public.record_visit(
  p_user_id uuid,
  p_key text,
  p_request_hash text,
  p_restaurant_id text,
  p_receipt_id text,
  p_bill_cents integer,
  p_now timestamptz default now(),
  p_fail_after_visit boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_restaurant public.restaurants%rowtype;
  v_idempotency public.idempotency_records%rowtype;
  v_visit_id uuid := gen_random_uuid();
  v_local_date date := (p_now at time zone 'America/Los_Angeles')::date;
  v_first_discovery boolean;
  v_xp integer;
  v_daily integer;
  v_response jsonb;
begin
  select * into v_profile from public.profiles where user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'status', 401, 'error', jsonb_build_object('code', 'UNAUTHENTICATED', 'message', 'Session is not authenticated', 'retryable', false));
  end if;

  select * into v_idempotency from public.idempotency_records
  where user_id = p_user_id and operation = 'visit' and key = p_key;
  if found then
    if v_idempotency.request_hash <> p_request_hash then
      return jsonb_build_object('ok', false, 'status', 409, 'error', jsonb_build_object('code', 'IDEMPOTENCY_CONFLICT', 'message', 'Idempotency key was reused with different input', 'retryable', false));
    end if;
    return jsonb_build_object('ok', true, 'status', v_idempotency.response_status, 'response', v_idempotency.response_json);
  end if;

  select * into v_restaurant from public.restaurants where id = p_restaurant_id;
  if not found then
    return jsonb_build_object('ok', false, 'status', 404, 'error', jsonb_build_object('code', 'RESTAURANT_NOT_FOUND', 'message', 'Restaurant was not found', 'retryable', false));
  end if;
  if p_bill_cents < 500 then
    return jsonb_build_object('ok', false, 'status', 422, 'error', jsonb_build_object('code', 'PURCHASE_TOO_SMALL', 'message', 'Demo bill must be at least 500 cents', 'retryable', false));
  end if;
  if exists (select 1 from public.visits where user_id = p_user_id and receipt_id = p_receipt_id) then
    return jsonb_build_object('ok', false, 'status', 409, 'error', jsonb_build_object('code', 'RECEIPT_ALREADY_USED', 'message', 'Receipt has already been used', 'retryable', false));
  end if;
  if exists (select 1 from public.visits where user_id = p_user_id and restaurant_id = p_restaurant_id and local_date = v_local_date) then
    return jsonb_build_object('ok', false, 'status', 409, 'error', jsonb_build_object('code', 'ALREADY_EARNED_TODAY', 'message', 'This restaurant already earned a reward today', 'retryable', false));
  end if;

  select coalesce(sum(credit_awarded_cents), 0)::integer into v_daily
  from public.visits where user_id = p_user_id and local_date = v_local_date;
  if v_daily + v_restaurant.reward_cents > 200 then
    return jsonb_build_object('ok', false, 'status', 409, 'error', jsonb_build_object('code', 'DAILY_REWARD_CAP', 'message', 'Daily reward cap has been reached', 'retryable', false));
  end if;

  v_first_discovery := not exists (select 1 from public.discoveries where user_id = p_user_id and restaurant_id = p_restaurant_id);
  v_xp := case when v_first_discovery then v_restaurant.discovery_xp else 0 end;

  insert into public.visits (id, user_id, restaurant_id, receipt_id, bill_cents, local_date, xp_awarded, credit_awarded_cents, created_at)
  values (v_visit_id, p_user_id, p_restaurant_id, p_receipt_id, p_bill_cents, v_local_date, v_xp, v_restaurant.reward_cents, p_now);
  if v_first_discovery then
    insert into public.discoveries (user_id, restaurant_id, first_visit_id, discovered_at)
    values (p_user_id, p_restaurant_id, v_visit_id, p_now);
  end if;
  if p_fail_after_visit then raise exception 'injected visit failure'; end if;

  insert into public.wallet_transactions (user_id, restaurant_id, kind, delta_cents, reference_id, created_at)
  values (p_user_id, p_restaurant_id, 'earn', v_restaurant.reward_cents, v_visit_id, p_now);
  update public.profiles set total_xp = total_xp + v_xp where user_id = p_user_id;

  v_response := jsonb_build_object(
    'visitId', v_visit_id,
    'restaurantId', p_restaurant_id,
    'firstDiscovery', v_first_discovery,
    'xpAwarded', v_xp,
    'creditAwardedCents', v_restaurant.reward_cents,
    'summary', public.get_summary(p_user_id),
    'verification', 'demo'
  );
  insert into public.idempotency_records (user_id, operation, key, request_hash, response_status, response_json, created_at)
  values (p_user_id, 'visit', p_key, p_request_hash, 201, v_response, p_now);
  return jsonb_build_object('ok', true, 'status', 201, 'response', v_response);
end;
$$;

create or replace function public.record_redemption(
  p_user_id uuid,
  p_key text,
  p_request_hash text,
  p_restaurant_id text,
  p_demo_receipt_id text,
  p_bill_cents integer,
  p_amount_cents integer,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_idempotency public.idempotency_records%rowtype;
  v_balance integer;
  v_redemption_id uuid := gen_random_uuid();
  v_response jsonb;
begin
  select * into v_profile from public.profiles where user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'status', 401, 'error', jsonb_build_object('code', 'UNAUTHENTICATED', 'message', 'Session is not authenticated', 'retryable', false));
  end if;

  select * into v_idempotency from public.idempotency_records
  where user_id = p_user_id and operation = 'redemption' and key = p_key;
  if found then
    if v_idempotency.request_hash <> p_request_hash then
      return jsonb_build_object('ok', false, 'status', 409, 'error', jsonb_build_object('code', 'IDEMPOTENCY_CONFLICT', 'message', 'Idempotency key was reused with different input', 'retryable', false));
    end if;
    return jsonb_build_object('ok', true, 'status', v_idempotency.response_status, 'response', v_idempotency.response_json);
  end if;

  if not exists (select 1 from public.restaurants where id = p_restaurant_id) then
    return jsonb_build_object('ok', false, 'status', 404, 'error', jsonb_build_object('code', 'RESTAURANT_NOT_FOUND', 'message', 'Restaurant was not found', 'retryable', false));
  end if;
  if exists (select 1 from public.redemptions where user_id = p_user_id and demo_receipt_id = p_demo_receipt_id) then
    return jsonb_build_object('ok', false, 'status', 409, 'error', jsonb_build_object('code', 'RECEIPT_ALREADY_USED', 'message', 'Receipt has already been used', 'retryable', false));
  end if;
  if p_amount_cents < 1 or p_amount_cents > 500 or p_amount_cents > p_bill_cents then
    return jsonb_build_object('ok', false, 'status', 422, 'error', jsonb_build_object('code', 'INVALID_REQUEST', 'message', 'Redemption amount is invalid', 'retryable', false));
  end if;

  select coalesce(sum(delta_cents), 0)::integer into v_balance from public.wallet_transactions where user_id = p_user_id;
  if p_amount_cents > v_balance then
    return jsonb_build_object('ok', false, 'status', 409, 'error', jsonb_build_object('code', 'INSUFFICIENT_BALANCE', 'message', 'Reward balance is insufficient', 'retryable', false));
  end if;
  if not exists (select 1 from public.visits where user_id = p_user_id and restaurant_id <> p_restaurant_id) then
    return jsonb_build_object('ok', false, 'status', 409, 'error', jsonb_build_object('code', 'PORTABILITY_REQUIRED', 'message', 'Earn at a different restaurant before redeeming here', 'retryable', false));
  end if;

  insert into public.redemptions (id, user_id, restaurant_id, demo_receipt_id, bill_cents, amount_cents, created_at)
  values (v_redemption_id, p_user_id, p_restaurant_id, p_demo_receipt_id, p_bill_cents, p_amount_cents, p_now);
  insert into public.wallet_transactions (user_id, restaurant_id, kind, delta_cents, reference_id, created_at)
  values (p_user_id, p_restaurant_id, 'redeem', -p_amount_cents, v_redemption_id, p_now);

  v_response := jsonb_build_object(
    'redemptionId', v_redemption_id,
    'restaurantId', p_restaurant_id,
    'amountCents', p_amount_cents,
    'settlementStatus', 'simulated',
    'summary', public.get_summary(p_user_id)
  );
  insert into public.idempotency_records (user_id, operation, key, request_hash, response_status, response_json, created_at)
  values (p_user_id, 'redemption', p_key, p_request_hash, 201, v_response, p_now);
  return jsonb_build_object('ok', true, 'status', 201, 'response', v_response);
end;
$$;

create or replace function public.consume_rate_limit(
  p_user_id uuid,
  p_category text,
  p_limit integer,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_category, 0));
  delete from public.rate_limit_events where created_at < p_now - interval '2 minutes';
  select count(*) into v_count from public.rate_limit_events
  where user_id = p_user_id and category = p_category and created_at > p_now - interval '1 minute';
  if v_count >= p_limit then return false; end if;
  insert into public.rate_limit_events (user_id, category, created_at) values (p_user_id, p_category, p_now);
  return true;
end;
$$;

revoke all on function public.get_summary(uuid) from public, anon, authenticated;
revoke all on function public.create_or_resume_demo_session(text, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.resolve_demo_session(text, timestamptz) from public, anon, authenticated;
revoke all on function public.get_idempotency_replay(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.record_visit(uuid, text, text, text, text, integer, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public.record_redemption(uuid, text, text, text, text, integer, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.consume_rate_limit(uuid, text, integer, timestamptz) from public, anon, authenticated;

grant execute on function public.get_summary(uuid) to service_role;
grant execute on function public.create_or_resume_demo_session(text, uuid, timestamptz) to service_role;
grant execute on function public.resolve_demo_session(text, timestamptz) to service_role;
grant execute on function public.get_idempotency_replay(uuid, text, text, text) to service_role;
grant execute on function public.record_visit(uuid, text, text, text, text, integer, timestamptz, boolean) to service_role;
grant execute on function public.record_redemption(uuid, text, text, text, text, integer, integer, timestamptz) to service_role;
grant execute on function public.consume_rate_limit(uuid, text, integer, timestamptz) to service_role;
