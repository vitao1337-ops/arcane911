-- Arcane911 V22 · livro-caixa privado de autorizações pagas
-- Execute no SQL Editor de um projeto Supabase exclusivo do Arcane911.
-- Nenhuma pergunta, carta, resposta, e-mail ou dado natal é armazenado aqui.

create schema if not exists arcane911_private;

revoke all on schema arcane911_private from public, anon, authenticated;
grant usage on schema arcane911_private to service_role;

create table if not exists arcane911_private.payment_entitlements (
  stripe_session_id text primary key,
  stripe_payment_intent_id text not null default '',
  order_id text not null unique,
  product_id text not null,
  reading_id text not null,
  reading_slug text not null default '',
  offer_context text not null default '',
  question_number smallint not null default 0,
  amount_total integer not null default 0,
  currency text not null default 'brl',
  livemode boolean not null default false,
  state text not null default 'active',
  claim_id text,
  verified_at timestamptz not null,
  claimed_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_entitlements_session_format
    check (stripe_session_id ~ '^cs_(test_|live_)?[A-Za-z0-9]{10,220}$'),
  constraint payment_entitlements_payment_intent_format
    check (stripe_payment_intent_id = '' or stripe_payment_intent_id ~ '^pi_[A-Za-z0-9]{10,220}$'),
  constraint payment_entitlements_order_format
    check (order_id ~ '^order-[A-Za-z0-9:._-]{12,114}$'),
  constraint payment_entitlements_product_length
    check (char_length(product_id) between 3 and 80),
  constraint payment_entitlements_reading_length
    check (char_length(reading_id) between 1 and 120),
  constraint payment_entitlements_question_number
    check (question_number between 0 and 3),
  constraint payment_entitlements_amount
    check (amount_total >= 0),
  constraint payment_entitlements_currency
    check (currency = 'brl'),
  constraint payment_entitlements_state
    check (state in ('active', 'processing', 'consumed')),
  constraint payment_entitlements_claim_state
    check (
      (state = 'active' and claim_id is null and claimed_at is null and consumed_at is null)
      or (state = 'processing' and claim_id is not null and claimed_at is not null and consumed_at is null)
      or (state = 'consumed' and claim_id is not null and claimed_at is not null and consumed_at is not null)
    )
);

-- Migração idempotente da versão 1 para a versão 2.
alter table arcane911_private.payment_entitlements
  add column if not exists stripe_payment_intent_id text not null default '',
  add column if not exists amount_total integer not null default 0,
  add column if not exists currency text not null default 'brl',
  add column if not exists livemode boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'payment_entitlements_payment_intent_format'
      and conrelid = 'arcane911_private.payment_entitlements'::regclass
  ) then
    alter table arcane911_private.payment_entitlements
      add constraint payment_entitlements_payment_intent_format
      check (stripe_payment_intent_id = '' or stripe_payment_intent_id ~ '^pi_[A-Za-z0-9]{10,220}$');
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'payment_entitlements_amount'
      and conrelid = 'arcane911_private.payment_entitlements'::regclass
  ) then
    alter table arcane911_private.payment_entitlements
      add constraint payment_entitlements_amount check (amount_total >= 0);
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'payment_entitlements_currency'
      and conrelid = 'arcane911_private.payment_entitlements'::regclass
  ) then
    alter table arcane911_private.payment_entitlements
      add constraint payment_entitlements_currency check (currency = 'brl');
  end if;
end;
$$;

alter table arcane911_private.payment_entitlements enable row level security;
alter table arcane911_private.payment_entitlements force row level security;
revoke all on table arcane911_private.payment_entitlements from public, anon, authenticated;
grant select, insert, update on table arcane911_private.payment_entitlements to service_role;

create index if not exists payment_entitlements_processing_idx
  on arcane911_private.payment_entitlements (claimed_at)
  where state = 'processing';

create index if not exists payment_entitlements_payment_intent_idx
  on arcane911_private.payment_entitlements (stripe_payment_intent_id)
  where stripe_payment_intent_id <> '';

-- Remove somente a assinatura V21 para não deixar uma RPC pública sobrecarregada.
drop function if exists public.arcane911_register_entitlement(
  text, text, text, text, text, text, smallint, timestamptz
);

create or replace function public.arcane911_payment_ledger_health()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'ready',
    pg_catalog.to_regclass('arcane911_private.payment_entitlements') is not null
      and coalesce((
        select c.relrowsecurity and c.relforcerowsecurity
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'arcane911_private'
          and c.relname = 'payment_entitlements'
      ), false)
      and 4 = (
        select count(distinct p.proname)
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in (
            'arcane911_register_entitlement',
            'arcane911_claim_entitlement',
            'arcane911_settle_entitlement',
            'arcane911_find_entitlement'
          )
      )
      and 4 = (
        select count(*)
        from information_schema.columns
        where table_schema = 'arcane911_private'
          and table_name = 'payment_entitlements'
          and column_name in (
            'stripe_payment_intent_id', 'amount_total', 'currency', 'livemode'
          )
      ),
    'version', 2
  );
$$;

create or replace function public.arcane911_register_entitlement(
  p_stripe_session_id text,
  p_payment_intent_id text,
  p_order_id text,
  p_product_id text,
  p_reading_id text,
  p_reading_slug text,
  p_offer_context text,
  p_question_number smallint,
  p_amount_total integer,
  p_currency text,
  p_livemode boolean,
  p_verified_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  stored arcane911_private.payment_entitlements%rowtype;
begin
  insert into arcane911_private.payment_entitlements (
    stripe_session_id,
    stripe_payment_intent_id,
    order_id,
    product_id,
    reading_id,
    reading_slug,
    offer_context,
    question_number,
    amount_total,
    currency,
    livemode,
    verified_at
  ) values (
    p_stripe_session_id,
    coalesce(p_payment_intent_id, ''),
    p_order_id,
    p_product_id,
    p_reading_id,
    coalesce(p_reading_slug, ''),
    coalesce(p_offer_context, ''),
    coalesce(p_question_number, 0),
    p_amount_total,
    lower(p_currency),
    coalesce(p_livemode, false),
    coalesce(p_verified_at, now())
  )
  on conflict (stripe_session_id) do nothing;

  -- Completa com segurança registros antigos criados antes da migração V22.
  update arcane911_private.payment_entitlements
  set
    stripe_payment_intent_id = case
      when stripe_payment_intent_id = '' then coalesce(p_payment_intent_id, '')
      else stripe_payment_intent_id
    end,
    currency = case when amount_total = 0 then lower(p_currency) else currency end,
    livemode = case when amount_total = 0 then coalesce(p_livemode, false) else livemode end,
    amount_total = case when amount_total = 0 then p_amount_total else amount_total end,
    updated_at = now()
  where stripe_session_id = p_stripe_session_id
    and order_id = p_order_id
    and product_id = p_product_id
    and reading_id = p_reading_id
    and reading_slug = coalesce(p_reading_slug, '')
    and offer_context = coalesce(p_offer_context, '')
    and question_number = coalesce(p_question_number, 0);

  select * into stored
  from arcane911_private.payment_entitlements
  where stripe_session_id = p_stripe_session_id;

  if stored.stripe_session_id is null
    or stored.order_id <> p_order_id
    or stored.product_id <> p_product_id
    or stored.reading_id <> p_reading_id
    or stored.reading_slug <> coalesce(p_reading_slug, '')
    or stored.offer_context <> coalesce(p_offer_context, '')
    or stored.question_number <> coalesce(p_question_number, 0)
    or stored.stripe_payment_intent_id <> coalesce(p_payment_intent_id, '')
    or stored.amount_total <> p_amount_total
    or stored.currency <> lower(p_currency)
    or stored.livemode <> coalesce(p_livemode, false)
  then
    return jsonb_build_object('registered', false, 'state', 'conflict');
  end if;

  return jsonb_build_object('registered', true, 'state', stored.state);
end;
$$;

create or replace function public.arcane911_claim_entitlement(
  p_stripe_session_id text,
  p_claim_id text,
  p_product_id text,
  p_reading_id text,
  p_question_number smallint default 0
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed arcane911_private.payment_entitlements%rowtype;
  current_state text;
begin
  update arcane911_private.payment_entitlements
  set
    state = 'processing',
    claim_id = p_claim_id,
    claimed_at = now(),
    consumed_at = null,
    updated_at = now()
  where stripe_session_id = p_stripe_session_id
    and product_id = p_product_id
    and reading_id = p_reading_id
    and question_number = coalesce(p_question_number, 0)
    and (
      state = 'active'
      or (state = 'processing' and claim_id = p_claim_id)
      or (state = 'processing' and claimed_at < now() - interval '5 minutes')
    )
  returning * into claimed;

  if claimed.stripe_session_id is not null then
    return jsonb_build_object('claimed', true, 'state', claimed.state);
  end if;

  select state into current_state
  from arcane911_private.payment_entitlements
  where stripe_session_id = p_stripe_session_id;

  return jsonb_build_object(
    'claimed', false,
    'state', coalesce(current_state, 'missing')
  );
end;
$$;

create or replace function public.arcane911_settle_entitlement(
  p_stripe_session_id text,
  p_claim_id text,
  p_outcome text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  settled arcane911_private.payment_entitlements%rowtype;
begin
  if p_outcome = 'consumed' then
    update arcane911_private.payment_entitlements
    set
      state = 'consumed',
      consumed_at = now(),
      updated_at = now()
    where stripe_session_id = p_stripe_session_id
      and claim_id = p_claim_id
      and state = 'processing'
    returning * into settled;

    if settled.stripe_session_id is null then
      select * into settled
      from arcane911_private.payment_entitlements
      where stripe_session_id = p_stripe_session_id
        and claim_id = p_claim_id
        and state = 'consumed';
    end if;
  elsif p_outcome = 'released' then
    update arcane911_private.payment_entitlements
    set
      state = 'active',
      claim_id = null,
      claimed_at = null,
      consumed_at = null,
      updated_at = now()
    where stripe_session_id = p_stripe_session_id
      and claim_id = p_claim_id
      and state = 'processing'
    returning * into settled;
  else
    return jsonb_build_object('settled', false, 'state', 'invalid_outcome');
  end if;

  return jsonb_build_object(
    'settled', settled.stripe_session_id is not null,
    'state', coalesce(settled.state, 'conflict')
  );
end;
$$;

create or replace function public.arcane911_find_entitlement(p_order_id text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  stored arcane911_private.payment_entitlements%rowtype;
begin
  select * into stored
  from arcane911_private.payment_entitlements
  where order_id = p_order_id;

  if stored.stripe_session_id is null then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'sessionId', stored.stripe_session_id,
    'orderId', stored.order_id,
    'productId', stored.product_id,
    'readingId', stored.reading_id,
    'readingSlug', stored.reading_slug,
    'offerContext', stored.offer_context,
    'questionNumber', stored.question_number,
    'amountTotal', stored.amount_total,
    'currency', stored.currency,
    'livemode', stored.livemode,
    'state', stored.state,
    'verifiedAt', stored.verified_at
  );
end;
$$;

revoke execute on function public.arcane911_payment_ledger_health()
from public, anon, authenticated;
revoke execute on function public.arcane911_register_entitlement(
  text, text, text, text, text, text, text, smallint, integer, text, boolean, timestamptz
) from public, anon, authenticated;
revoke execute on function public.arcane911_claim_entitlement(
  text, text, text, text, smallint
) from public, anon, authenticated;
revoke execute on function public.arcane911_settle_entitlement(
  text, text, text
) from public, anon, authenticated;
revoke execute on function public.arcane911_find_entitlement(text)
from public, anon, authenticated;

grant execute on function public.arcane911_payment_ledger_health()
to service_role;
grant execute on function public.arcane911_register_entitlement(
  text, text, text, text, text, text, text, smallint, integer, text, boolean, timestamptz
) to service_role;
grant execute on function public.arcane911_claim_entitlement(
  text, text, text, text, smallint
) to service_role;
grant execute on function public.arcane911_settle_entitlement(
  text, text, text
) to service_role;
grant execute on function public.arcane911_find_entitlement(text)
to service_role;

notify pgrst, 'reload schema';

-- Verificação final (resultado esperado: {"ready": true, "version": 2}):
-- select public.arcane911_payment_ledger_health();
