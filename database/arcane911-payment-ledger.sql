-- Arcane911 V24 Mercado Pago · livro-caixa privado de autorizações e slots pagos
-- Execute no SQL Editor de um projeto Supabase exclusivo do Arcane911.
-- Nenhuma pergunta, carta, resposta, e-mail ou dado natal é armazenado aqui.

create schema if not exists arcane911_private;

revoke all on schema arcane911_private from public, anon, authenticated;
grant usage on schema arcane911_private to service_role;

create table if not exists arcane911_private.payment_entitlements (
  payment_id text primary key,
  provider_transaction_id text not null default '',
  order_id text not null unique,
  product_id text not null,
  product_kind text not null default 'single_use',
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
  constraint payment_entitlements_payment_id_format
    check (payment_id ~ '^mp-[0-9]{5,30}$'),
  constraint payment_entitlements_provider_ref_format
    check (provider_transaction_id = '' or provider_transaction_id ~ '^mp-[0-9]{5,30}$'),
  constraint payment_entitlements_order_format
    check (order_id ~ '^order-[A-Za-z0-9:._-]{12,114}$'),
  constraint payment_entitlements_product_length
    check (char_length(product_id) between 3 and 80),
  constraint payment_entitlements_product_kind
    check (product_kind in (
      'complete_reading', 'agent_question', 'specific_complete',
      'specific_standalone', 'astral_document', 'single_use'
    )),
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

-- Complementos idempotentes da versão 4 em uma instalação já neutra.
alter table arcane911_private.payment_entitlements
  add column if not exists provider_transaction_id text not null default '',
  add column if not exists product_kind text not null default 'single_use',
  add column if not exists amount_total integer not null default 0,
  add column if not exists currency text not null default 'brl',
  add column if not exists livemode boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'payment_entitlements_product_kind'
      and conrelid = 'arcane911_private.payment_entitlements'::regclass
  ) then
    alter table arcane911_private.payment_entitlements
      add constraint payment_entitlements_product_kind check (product_kind in (
        'complete_reading', 'agent_question', 'specific_complete',
        'specific_standalone', 'astral_document', 'single_use'
      ));
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'payment_entitlements_provider_ref_format'
      and conrelid = 'arcane911_private.payment_entitlements'::regclass
  ) then
    alter table arcane911_private.payment_entitlements
      add constraint payment_entitlements_provider_ref_format
      check (provider_transaction_id = '' or provider_transaction_id ~ '^mp-[0-9]{5,30}$');
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

-- IDs padrão são migrados sem depender de dados pessoais. IDs customizados são
-- preenchidos na próxima confirmação/webhook pelo catálogo confiável do servidor.
update arcane911_private.payment_entitlements
set product_kind = case product_id
  when 'arcane911-leitura-profunda' then 'complete_reading'
  when 'agent911-pergunta' then 'agent_question'
  when 'arcane911-pergunta-especifica-completa' then 'specific_complete'
  when 'arcane911-pergunta-especifica-avulsa' then 'specific_standalone'
  when 'astro911-documento-completo' then 'astral_document'
  else product_kind
end
where product_kind = 'single_use';

alter table arcane911_private.payment_entitlements enable row level security;
alter table arcane911_private.payment_entitlements force row level security;
revoke all on table arcane911_private.payment_entitlements from public, anon, authenticated;
grant select, insert, update on table arcane911_private.payment_entitlements to service_role;

create table if not exists arcane911_private.payment_claims (
  payment_id text not null references arcane911_private.payment_entitlements(payment_id) on delete cascade,
  claim_scope text not null,
  claim_slot smallint not null,
  claim_id text not null,
  state text not null default 'processing',
  claimed_at timestamptz not null default now(),
  consumed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (payment_id, claim_scope, claim_slot),
  constraint payment_claims_scope_slot check (
    (claim_scope = 'complete_summary' and claim_slot = 0)
    or (claim_scope = 'specific_summary' and claim_slot between 1 and 5)
  ),
  constraint payment_claims_id_format check (claim_id ~ '^[A-Za-z0-9:._-]{12,120}$'),
  constraint payment_claims_state check (state in ('processing', 'consumed')),
  constraint payment_claims_consumed_state check (
    (state = 'processing' and consumed_at is null)
    or (state = 'consumed' and consumed_at is not null)
  )
);

alter table arcane911_private.payment_claims enable row level security;
alter table arcane911_private.payment_claims force row level security;
revoke all on table arcane911_private.payment_claims from public, anon, authenticated;
grant select, insert, update, delete on table arcane911_private.payment_claims to service_role;

create index if not exists payment_claims_processing_idx
  on arcane911_private.payment_claims (claimed_at)
  where state = 'processing';

-- Uma síntese completa já consumida na V22 vira o slot 0 do bundle. Assim a
-- migração não concede uma segunda chamada cara a compras antigas.
insert into arcane911_private.payment_claims (
  payment_id, claim_scope, claim_slot, claim_id, state, claimed_at, consumed_at
)
select
  payment_id,
  'complete_summary',
  0,
  coalesce(claim_id, 'legacy-' || md5(payment_id || ':complete_summary')),
  'consumed',
  coalesce(claimed_at, verified_at),
  coalesce(consumed_at, updated_at)
from arcane911_private.payment_entitlements
where product_kind = 'complete_reading' and state = 'consumed'
on conflict (payment_id, claim_scope, claim_slot) do nothing;

update arcane911_private.payment_entitlements
set state = 'active', claim_id = null, claimed_at = null, consumed_at = null, updated_at = now()
where product_kind = 'complete_reading' and state = 'consumed';

create index if not exists payment_entitlements_processing_idx
  on arcane911_private.payment_entitlements (claimed_at)
  where state = 'processing';

create index if not exists payment_entitlements_provider_ref_idx
  on arcane911_private.payment_entitlements (provider_transaction_id)
  where provider_transaction_id <> '';

-- Remove somente a assinatura V21 para não deixar uma RPC pública sobrecarregada.
drop function if exists public.arcane911_register_entitlement(
  text, text, text, text, text, text, smallint, timestamptz
);
drop function if exists public.arcane911_register_entitlement(
  text, text, text, text, text, text, text, smallint, integer, text, boolean, timestamptz
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
      and pg_catalog.to_regclass('arcane911_private.payment_claims') is not null
      and coalesce((
        select c.relrowsecurity and c.relforcerowsecurity
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'arcane911_private'
          and c.relname = 'payment_entitlements'
      ), false)
      and coalesce((
        select c.relrowsecurity and c.relforcerowsecurity
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'arcane911_private'
          and c.relname = 'payment_claims'
      ), false)
      and 6 = (
        select count(distinct p.proname)
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in (
            'arcane911_register_entitlement',
            'arcane911_claim_entitlement',
            'arcane911_settle_entitlement',
            'arcane911_claim_bundle_entitlement',
            'arcane911_settle_bundle_entitlement',
            'arcane911_find_entitlement'
          )
      )
      and 5 = (
        select count(*)
        from information_schema.columns
        where table_schema = 'arcane911_private'
          and table_name = 'payment_entitlements'
          and column_name in (
            'provider_transaction_id', 'product_kind', 'amount_total', 'currency', 'livemode'
          )
      ),
    'version', 4
  );
$$;

create or replace function public.arcane911_register_entitlement(
  p_payment_id text,
  p_provider_transaction_id text,
  p_order_id text,
  p_product_id text,
  p_product_kind text,
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
    payment_id,
    provider_transaction_id,
    order_id,
    product_id,
    product_kind,
    reading_id,
    reading_slug,
    offer_context,
    question_number,
    amount_total,
    currency,
    livemode,
    verified_at
  ) values (
    p_payment_id,
    coalesce(p_provider_transaction_id, ''),
    p_order_id,
    p_product_id,
    p_product_kind,
    p_reading_id,
    coalesce(p_reading_slug, ''),
    coalesce(p_offer_context, ''),
    coalesce(p_question_number, 0),
    p_amount_total,
    lower(p_currency),
    coalesce(p_livemode, false),
    coalesce(p_verified_at, now())
  )
  on conflict (payment_id) do nothing;

  -- Completa com segurança registros antigos criados antes da migração V22.
  update arcane911_private.payment_entitlements
  set
    provider_transaction_id = case
      when provider_transaction_id = '' then coalesce(p_provider_transaction_id, '')
      else provider_transaction_id
    end,
    product_kind = case
      when product_kind = 'single_use' then p_product_kind
      else product_kind
    end,
    currency = case when amount_total = 0 then lower(p_currency) else currency end,
    livemode = case when amount_total = 0 then coalesce(p_livemode, false) else livemode end,
    amount_total = case when amount_total = 0 then p_amount_total else amount_total end,
    updated_at = now()
  where payment_id = p_payment_id
    and order_id = p_order_id
    and product_id = p_product_id
    and reading_id = p_reading_id
    and reading_slug = coalesce(p_reading_slug, '')
    and offer_context = coalesce(p_offer_context, '')
    and question_number = coalesce(p_question_number, 0);

  select * into stored
  from arcane911_private.payment_entitlements
  where payment_id = p_payment_id;

  if stored.payment_id is null
    or stored.order_id <> p_order_id
    or stored.product_id <> p_product_id
    or stored.product_kind <> p_product_kind
    or stored.reading_id <> p_reading_id
    or stored.reading_slug <> coalesce(p_reading_slug, '')
    or stored.offer_context <> coalesce(p_offer_context, '')
    or stored.question_number <> coalesce(p_question_number, 0)
    or stored.provider_transaction_id <> coalesce(p_provider_transaction_id, '')
    or stored.amount_total <> p_amount_total
    or stored.currency <> lower(p_currency)
    or stored.livemode <> coalesce(p_livemode, false)
  then
    return jsonb_build_object('registered', false, 'state', 'conflict');
  end if;

  return jsonb_build_object(
    'registered', true,
    'state', stored.state,
    'completeSummaryUsed', exists (
      select 1 from arcane911_private.payment_claims c
      where c.payment_id = stored.payment_id
        and c.claim_scope = 'complete_summary'
        and c.claim_slot = 0
        and c.state = 'consumed'
    ),
    'includedQuestionsUsed', (
      select count(*) from arcane911_private.payment_claims c
      where c.payment_id = stored.payment_id
        and c.claim_scope = 'specific_summary'
        and c.state = 'consumed'
    )
  );
end;
$$;

create or replace function public.arcane911_claim_entitlement(
  p_payment_id text,
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
  where payment_id = p_payment_id
    and product_id = p_product_id
    and reading_id = p_reading_id
    and question_number = coalesce(p_question_number, 0)
    and (
      state = 'active'
      or (state = 'processing' and claim_id = p_claim_id)
      or (state = 'processing' and claimed_at < now() - interval '5 minutes')
    )
  returning * into claimed;

  if claimed.payment_id is not null then
    return jsonb_build_object('claimed', true, 'state', claimed.state);
  end if;

  select state into current_state
  from arcane911_private.payment_entitlements
  where payment_id = p_payment_id;

  return jsonb_build_object(
    'claimed', false,
    'state', coalesce(current_state, 'missing')
  );
end;
$$;

create or replace function public.arcane911_settle_entitlement(
  p_payment_id text,
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
    where payment_id = p_payment_id
      and claim_id = p_claim_id
      and state = 'processing'
    returning * into settled;

    if settled.payment_id is null then
      select * into settled
      from arcane911_private.payment_entitlements
      where payment_id = p_payment_id
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
    where payment_id = p_payment_id
      and claim_id = p_claim_id
      and state = 'processing'
    returning * into settled;
  else
    return jsonb_build_object('settled', false, 'state', 'invalid_outcome');
  end if;

  return jsonb_build_object(
    'settled', settled.payment_id is not null,
    'state', coalesce(settled.state, 'conflict')
  );
end;
$$;

create or replace function public.arcane911_claim_bundle_entitlement(
  p_payment_id text,
  p_claim_id text,
  p_product_id text,
  p_reading_id text,
  p_claim_scope text,
  p_claim_slot smallint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed arcane911_private.payment_claims%rowtype;
  current_state text;
begin
  if not (
    (p_claim_scope = 'complete_summary' and p_claim_slot = 0)
    or (p_claim_scope = 'specific_summary' and p_claim_slot between 1 and 5)
  ) then
    return jsonb_build_object('claimed', false, 'state', 'invalid_slot');
  end if;

  insert into arcane911_private.payment_claims as existing (
    payment_id, claim_scope, claim_slot, claim_id, state, claimed_at, consumed_at, updated_at
  )
  select
    e.payment_id,
    p_claim_scope,
    p_claim_slot,
    p_claim_id,
    'processing',
    now(),
    null,
    now()
  from arcane911_private.payment_entitlements e
  where e.payment_id = p_payment_id
    and e.product_id = p_product_id
    and e.product_kind = 'complete_reading'
    and e.reading_id = p_reading_id
  on conflict (payment_id, claim_scope, claim_slot) do update
  set
    claim_id = excluded.claim_id,
    state = 'processing',
    claimed_at = now(),
    consumed_at = null,
    updated_at = now()
  where (
    existing.state = 'processing'
    and existing.claim_id = excluded.claim_id
  ) or (
    existing.state = 'processing'
    and existing.claimed_at < now() - interval '5 minutes'
  )
  returning * into claimed;

  if claimed.payment_id is not null then
    return jsonb_build_object('claimed', true, 'state', claimed.state);
  end if;

  select state into current_state
  from arcane911_private.payment_claims
  where payment_id = p_payment_id
    and claim_scope = p_claim_scope
    and claim_slot = p_claim_slot;

  return jsonb_build_object('claimed', false, 'state', coalesce(current_state, 'missing'));
end;
$$;

create or replace function public.arcane911_settle_bundle_entitlement(
  p_payment_id text,
  p_claim_id text,
  p_claim_scope text,
  p_claim_slot smallint,
  p_outcome text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  settled arcane911_private.payment_claims%rowtype;
begin
  if p_outcome = 'consumed' then
    update arcane911_private.payment_claims
    set state = 'consumed', consumed_at = now(), updated_at = now()
    where payment_id = p_payment_id
      and claim_scope = p_claim_scope
      and claim_slot = p_claim_slot
      and claim_id = p_claim_id
      and state = 'processing'
    returning * into settled;

    if settled.payment_id is null then
      select * into settled
      from arcane911_private.payment_claims
      where payment_id = p_payment_id
        and claim_scope = p_claim_scope
        and claim_slot = p_claim_slot
        and claim_id = p_claim_id
        and state = 'consumed';
    end if;
  elsif p_outcome = 'released' then
    delete from arcane911_private.payment_claims
    where payment_id = p_payment_id
      and claim_scope = p_claim_scope
      and claim_slot = p_claim_slot
      and claim_id = p_claim_id
      and state = 'processing'
    returning * into settled;
  else
    return jsonb_build_object('settled', false, 'state', 'invalid_outcome');
  end if;

  return jsonb_build_object(
    'settled', settled.payment_id is not null,
    'state', case when p_outcome = 'released' then 'active' else coalesce(settled.state, 'conflict') end
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

  if stored.payment_id is null then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'sessionId', stored.payment_id,
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
    'completeSummaryUsed', exists (
      select 1 from arcane911_private.payment_claims c
      where c.payment_id = stored.payment_id
        and c.claim_scope = 'complete_summary'
        and c.claim_slot = 0
        and c.state = 'consumed'
    ),
    'includedQuestionsUsed', (
      select count(*) from arcane911_private.payment_claims c
      where c.payment_id = stored.payment_id
        and c.claim_scope = 'specific_summary'
        and c.state = 'consumed'
    ),
    'verifiedAt', stored.verified_at
  );
end;
$$;

revoke execute on function public.arcane911_payment_ledger_health()
from public, anon, authenticated;
revoke execute on function public.arcane911_register_entitlement(
  text, text, text, text, text, text, text, text, smallint, integer, text, boolean, timestamptz
) from public, anon, authenticated;
revoke execute on function public.arcane911_claim_entitlement(
  text, text, text, text, smallint
) from public, anon, authenticated;
revoke execute on function public.arcane911_settle_entitlement(
  text, text, text
) from public, anon, authenticated;
revoke execute on function public.arcane911_claim_bundle_entitlement(
  text, text, text, text, text, smallint
) from public, anon, authenticated;
revoke execute on function public.arcane911_settle_bundle_entitlement(
  text, text, text, smallint, text
) from public, anon, authenticated;
revoke execute on function public.arcane911_find_entitlement(text)
from public, anon, authenticated;

grant execute on function public.arcane911_payment_ledger_health()
to service_role;
grant execute on function public.arcane911_register_entitlement(
  text, text, text, text, text, text, text, text, smallint, integer, text, boolean, timestamptz
) to service_role;
grant execute on function public.arcane911_claim_entitlement(
  text, text, text, text, smallint
) to service_role;
grant execute on function public.arcane911_settle_entitlement(
  text, text, text
) to service_role;
grant execute on function public.arcane911_claim_bundle_entitlement(
  text, text, text, text, text, smallint
) to service_role;
grant execute on function public.arcane911_settle_bundle_entitlement(
  text, text, text, smallint, text
) to service_role;
grant execute on function public.arcane911_find_entitlement(text)
to service_role;

notify pgrst, 'reload schema';

-- Verificação final (resultado esperado: {"ready": true, "version": 4}):
-- select public.arcane911_payment_ledger_health();
