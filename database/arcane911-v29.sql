-- Arcane911 V29: execute AFTER arcane911-payment-ledger.sql.
-- Additive upgrade. No Sorriso Marcado objects or customer rows are deleted.
begin;

alter table arcane911_private.astral_orders
  add column if not exists birth_utc timestamptz,
  add column if not exists utc_offset_minutes numeric;

alter table arcane911_private.payment_entitlements
  drop constraint if exists payment_entitlements_state,
  drop constraint if exists payment_entitlements_claim_state;
alter table arcane911_private.payment_entitlements
  add constraint payment_entitlements_state check (state in ('active','processing','consumed','revoked')),
  add constraint payment_entitlements_claim_state check (
    state = 'revoked'
    or (state = 'active' and claim_id is null and claimed_at is null and consumed_at is null)
    or (state = 'processing' and claim_id is not null and claimed_at is not null and consumed_at is null)
    or (state = 'consumed' and claim_id is not null and claimed_at is not null and consumed_at is not null)
  );

create table if not exists arcane911_private.purchase_drafts (
  order_id text primary key,
  product_id text not null,
  reading_id text not null,
  amount_total integer not null check (amount_total > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 100000),
  created_at timestamptz not null default now(),
  check (order_id ~ '^order-[A-Za-z0-9:._-]{12,114}$')
);
create table if not exists arcane911_private.paid_results (
  payment_id text not null references arcane911_private.payment_entitlements(payment_id) on delete restrict,
  scope text not null check (scope in ('single','complete_summary','specific_summary','astral_question')),
  slot smallint not null check (slot between 0 and 5),
  claim_id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 200000),
  input jsonb not null check (jsonb_typeof(input) = 'object' and octet_length(input::text) <= 100000),
  created_at timestamptz not null default now(),
  primary key (payment_id, scope, slot),
  unique (payment_id, scope, claim_id)
);
create table if not exists arcane911_private.payment_revocations (
  payment_id text primary key check (payment_id ~ '^mp-[0-9]{5,30}$'),
  reason text not null check (reason in ('refunded','charged_back','cancelled')),
  created_at timestamptz not null default now()
);
alter table arcane911_private.purchase_drafts enable row level security;
alter table arcane911_private.purchase_drafts force row level security;
alter table arcane911_private.paid_results enable row level security;
alter table arcane911_private.paid_results force row level security;
alter table arcane911_private.payment_revocations enable row level security;
alter table arcane911_private.payment_revocations force row level security;
revoke all on arcane911_private.purchase_drafts, arcane911_private.paid_results, arcane911_private.payment_revocations from public, anon, authenticated;
grant select, insert, update, delete on arcane911_private.purchase_drafts to service_role;
grant select, insert on arcane911_private.paid_results to service_role;
grant select, insert, update on arcane911_private.payment_revocations to service_role;

create or replace function public.arcane911_prepare_purchase(
  p_order_id text, p_product_id text, p_reading_id text, p_amount_total integer, p_snapshot jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare d arcane911_private.purchase_drafts%rowtype;
begin
  if p_snapshot is not null then
    insert into arcane911_private.purchase_drafts(order_id,product_id,reading_id,amount_total,snapshot)
    values(p_order_id,p_product_id,p_reading_id,p_amount_total,p_snapshot)
    on conflict (order_id) do nothing;
  end if;
  select * into d from arcane911_private.purchase_drafts where order_id = p_order_id;
  return jsonb_build_object('prepared', d.order_id is not null and d.product_id = p_product_id and d.reading_id = p_reading_id
    and d.amount_total = p_amount_total and (p_snapshot is null or d.snapshot = p_snapshot),
    'paymentId',(select payment_id from arcane911_private.payment_entitlements where order_id = p_order_id),
    'state',(select state from arcane911_private.payment_entitlements where order_id = p_order_id));
end;
$$;

create or replace function public.arcane911_revoke_entitlement(p_payment_id text, p_reason text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  -- Tombstone also handles a refund notification arriving before approval.
  perform pg_advisory_xact_lock(hashtext(p_payment_id));
  insert into arcane911_private.payment_revocations(payment_id,reason) values(p_payment_id,p_reason)
    on conflict (payment_id) do update set reason = excluded.reason;
  update arcane911_private.payment_entitlements set state = 'revoked', updated_at = now()
    where payment_id = p_payment_id;
  return jsonb_build_object('revoked',true);
end;
$$;

create or replace function arcane911_private.guard_revoked_payment()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.payment_id));
  if exists(select 1 from arcane911_private.payment_revocations where payment_id = new.payment_id) then
    new.state := 'revoked';
  end if;
  return new;
end;
$$;
drop trigger if exists arcane911_guard_revoked_payment on arcane911_private.payment_entitlements;
create trigger arcane911_guard_revoked_payment before insert on arcane911_private.payment_entitlements
for each row execute function arcane911_private.guard_revoked_payment();

create or replace function arcane911_private.queue_paid_astral_order()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare d arcane911_private.purchase_drafts%rowtype; c jsonb; r jsonb;
begin
  if new.product_kind <> 'astral_document' or new.state = 'revoked' then return new; end if;
  select * into d from arcane911_private.purchase_drafts where order_id = new.order_id;
  -- Legacy purchases may predate drafts. New payment entry points require them.
  if d.order_id is null then return new; end if;
  if d.product_id <> new.product_id or d.reading_id <> new.reading_id or d.amount_total <> new.amount_total then
    raise exception 'purchase_draft_mismatch';
  end if;
  c := d.snapshot->'chart';
  if c is null then raise exception 'astral_snapshot_required'; end if;
  r := public.arcane911_register_astral_order(new.payment_id,new.order_id,new.reading_id,
    c->>'person',d.snapshot->>'email',(c#>>'{birth,date}')::date,(c#>>'{birth,time}')::time,
    c#>>'{location,name}',c#>>'{location,admin1}',c#>>'{location,country}',c#>>'{location,timezone}',
    (c#>>'{location,latitude}')::double precision,(c#>>'{location,longitude}')::double precision);
  if (r->>'registered')::boolean is not true then raise exception 'astral_queue_failed'; end if;
  update arcane911_private.astral_orders set birth_utc = (c#>>'{birth,utc}')::timestamptz,
    utc_offset_minutes = (c#>>'{birth,utcOffsetMinutes}')::numeric where payment_id = new.payment_id;
  return new;
end;
$$;
drop trigger if exists arcane911_queue_paid_astral on arcane911_private.payment_entitlements;
create trigger arcane911_queue_paid_astral after insert on arcane911_private.payment_entitlements
for each row execute function arcane911_private.queue_paid_astral_order();

create or replace function public.arcane911_read_paid_content(p_payment_id text, p_product_id text, p_reading_id text, p_order_id text)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare e arcane911_private.payment_entitlements%rowtype;
begin
  select * into e from arcane911_private.payment_entitlements where payment_id = p_payment_id
    and product_id = p_product_id and reading_id = p_reading_id and order_id = p_order_id;
  if e.payment_id is null or e.state = 'revoked' then
    return jsonb_build_object('authorized',false,'state',coalesce(e.state,'missing'));
  end if;
  return jsonb_build_object('authorized',true,'state',e.state,
    'snapshot',(select snapshot from arcane911_private.purchase_drafts where order_id = e.order_id),
    'results',coalesce((select jsonb_agg(jsonb_build_object('scope',scope,'slot',slot,'claimId',claim_id,
      'payload',payload,'input',input,'createdAt',created_at) order by created_at)
      from arcane911_private.paid_results where payment_id = e.payment_id),'[]'::jsonb));
end;
$$;

create or replace function public.arcane911_complete_paid_content(
  p_payment_id text, p_claim_id text, p_scope text, p_slot smallint, p_payload jsonb, p_input jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare e arcane911_private.payment_entitlements%rowtype; r jsonb; saved jsonb;
begin
  -- The same lock serializes credit settlement, fulfillment and revocations.
  select * into e from arcane911_private.payment_entitlements where payment_id = p_payment_id for update;
  if e.payment_id is null or e.state = 'revoked' then
    return jsonb_build_object('settled',false,'state',coalesce(e.state,'missing'));
  end if;
  select payload into saved from arcane911_private.paid_results
    where payment_id = p_payment_id and scope = p_scope and slot = p_slot and claim_id = p_claim_id;
  if saved is not null then return jsonb_build_object('settled',true,'payload',saved); end if;
  if p_scope = 'single' and p_slot = 0 then
    r := public.arcane911_settle_entitlement(p_payment_id,p_claim_id,'consumed');
  elsif p_scope in ('complete_summary','specific_summary') then
    r := public.arcane911_settle_bundle_entitlement(p_payment_id,p_claim_id,p_scope,p_slot,'consumed');
  elsif p_scope = 'astral_question' then
    r := public.arcane911_settle_astral_question(p_payment_id,p_claim_id,p_slot,'consumed');
  else
    return jsonb_build_object('settled',false,'state','invalid_scope');
  end if;
  if (r->>'settled')::boolean is not true then return r; end if;
  saved := p_payload;
  if p_scope = 'astral_question' then
    saved := saved || jsonb_build_object('slot',p_slot,'questionsAvailable',5,
      'questionsUsed',(select questions_used from arcane911_private.astral_orders where payment_id = p_payment_id));
  end if;
  insert into arcane911_private.paid_results(payment_id,scope,slot,claim_id,payload,input)
    values(p_payment_id,p_scope,p_slot,p_claim_id,saved,p_input);
  -- Any failure above rolls back BOTH the result and the consumed credit.
  return jsonb_build_object('settled',true,'payload',saved);
end;
$$;

create or replace function public.arcane911_claim_astral_question(p_payment_id text,p_order_id text,p_reading_id text,p_claim_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare target_slot smallint; prior arcane911_private.payment_claims%rowtype; saved jsonb;
begin
  perform 1 from arcane911_private.payment_entitlements where payment_id = p_payment_id and state <> 'revoked' for update;
  if not found then return jsonb_build_object('claimed',false,'state','revoked'); end if;
  if not exists(select 1 from arcane911_private.astral_orders o
      where o.payment_id = p_payment_id and o.order_id = p_order_id and o.reading_id = p_reading_id
      and o.status = 'delivered' and o.questions_available = 5) then
    return jsonb_build_object('claimed',false,'state','delivery_required');
  end if;
  select payload into saved from arcane911_private.paid_results
    where payment_id = p_payment_id and scope = 'astral_question' and claim_id = p_claim_id;
  if saved is not null then return jsonb_build_object('replayed',true,'payload',saved); end if;
  delete from arcane911_private.payment_claims where payment_id = p_payment_id
    and claim_scope = 'astral_question' and state = 'processing' and claimed_at < now() - interval '5 minutes';
  select * into prior from arcane911_private.payment_claims where payment_id = p_payment_id
    and claim_scope = 'astral_question' and claim_id = p_claim_id;
  if prior.payment_id is not null then return jsonb_build_object('claimed',false,'state',prior.state); end if;
  select s::smallint into target_slot from generate_series(1,5) as s where not exists(
    select 1 from arcane911_private.payment_claims c where c.payment_id = p_payment_id
      and c.claim_scope = 'astral_question' and c.claim_slot = s) order by s limit 1;
  if target_slot is null then return jsonb_build_object('claimed',false,'state','credits_exhausted'); end if;
  insert into arcane911_private.payment_claims(payment_id,claim_scope,claim_slot,claim_id,state)
    values(p_payment_id,'astral_question',target_slot,p_claim_id,'processing');
  return jsonb_build_object('claimed',true,'state','processing','slot',target_slot);
end;
$$;

create or replace function public.arcane911_get_astral_order_status(p_payment_id text,p_order_id text,p_reading_id text)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare o arcane911_private.astral_orders%rowtype;
begin
  select a.* into o from arcane911_private.astral_orders a
    join arcane911_private.payment_entitlements e on e.payment_id = a.payment_id
    where a.payment_id = p_payment_id and a.order_id = p_order_id and a.reading_id = p_reading_id and e.state <> 'revoked';
  if o.payment_id is null then return jsonb_build_object('found',false); end if;
  return jsonb_build_object('found',true,'status',o.status,'questionsAvailable',o.questions_available,
    'questionsUsed',o.questions_used,'createdAt',o.created_at,'deliveredAt',o.delivered_at,
    'answers',coalesce((select jsonb_agg(jsonb_build_object('id',claim_id,'question',input->>'question',
      'answer',payload->>'answer','slot',slot) order by slot) from arcane911_private.paid_results
      where payment_id = p_payment_id and scope = 'astral_question'),'[]'::jsonb));
end;
$$;

create or replace function public.arcane911_payment_ledger_health()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('ready',
    to_regclass('arcane911_private.paid_results') is not null
    and to_regclass('arcane911_private.purchase_drafts') is not null
    and to_regclass('arcane911_private.payment_revocations') is not null
    and to_regprocedure('public.arcane911_complete_paid_content(text,text,text,smallint,jsonb,jsonb)') is not null,
    'version',5);
$$;
create or replace function public.arcane911_astral_fulfillment_health()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('ready',to_regclass('arcane911_private.astral_orders') is not null
    and to_regprocedure('arcane911_private.queue_paid_astral_order()') is not null
    and to_regprocedure('public.arcane911_claim_astral_question(text,text,text,text)') is not null,'version',2);
$$;

revoke execute on function public.arcane911_prepare_purchase(text,text,text,integer,jsonb) from public,anon,authenticated;
revoke execute on function public.arcane911_revoke_entitlement(text,text) from public,anon,authenticated;
revoke execute on function public.arcane911_read_paid_content(text,text,text,text) from public,anon,authenticated;
revoke execute on function public.arcane911_complete_paid_content(text,text,text,smallint,jsonb,jsonb) from public,anon,authenticated;
revoke execute on function arcane911_private.guard_revoked_payment(), arcane911_private.queue_paid_astral_order() from public,anon,authenticated;
grant execute on function public.arcane911_prepare_purchase(text,text,text,integer,jsonb) to service_role;
grant execute on function public.arcane911_revoke_entitlement(text,text) to service_role;
grant execute on function public.arcane911_read_paid_content(text,text,text,text) to service_role;
grant execute on function public.arcane911_complete_paid_content(text,text,text,smallint,jsonb,jsonb) to service_role;
grant execute on function arcane911_private.guard_revoked_payment(), arcane911_private.queue_paid_astral_order() to service_role;

notify pgrst, 'reload schema';
commit;
