-- Arcane911 V31: revisão humana, PDF privado e entrega controlada.
-- Execute DEPOIS de arcane911-payment-ledger.sql e arcane911-v29.sql.
-- Migração aditiva: não apaga pedidos, pagamentos nem respostas existentes.
begin;

alter table arcane911_private.astral_orders
  add column if not exists questionnaire jsonb not null default '{"clarity":[],"patterns":[],"traits":[]}'::jsonb,
  add column if not exists draft_payload jsonb,
  add column if not exists draft_version integer not null default 0,
  add column if not exists review_note text not null default '',
  add column if not exists reviewer_notified_at timestamptz,
  add column if not exists pdf_path text,
  add column if not exists pdf_uploaded_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists delivery_email_id text;

alter table arcane911_private.astral_orders
  drop constraint if exists astral_orders_questionnaire_shape,
  drop constraint if exists astral_orders_draft_size,
  drop constraint if exists astral_orders_review_note_size,
  drop constraint if exists astral_orders_pdf_path;
alter table arcane911_private.astral_orders
  add constraint astral_orders_questionnaire_shape check (
    jsonb_typeof(questionnaire) = 'object'
    and jsonb_typeof(coalesce(questionnaire->'clarity', '[]'::jsonb)) = 'array'
    and jsonb_typeof(coalesce(questionnaire->'patterns', '[]'::jsonb)) = 'array'
    and jsonb_typeof(coalesce(questionnaire->'traits', '[]'::jsonb)) = 'array'
    and octet_length(questionnaire::text) <= 6000
  ),
  add constraint astral_orders_draft_size check (
    draft_payload is null or (jsonb_typeof(draft_payload) = 'object' and octet_length(draft_payload::text) <= 500000)
  ),
  add constraint astral_orders_review_note_size check (char_length(review_note) <= 4000),
  add constraint astral_orders_pdf_path check (
    pdf_path is null or (char_length(pdf_path) between 12 and 500 and pdf_path ~ '^astral/[A-Za-z0-9._/-]+[.]pdf$')
  );

update arcane911_private.astral_orders a
set questionnaire = d.snapshot->'questionnaire'
from arcane911_private.purchase_drafts d
where d.order_id = a.order_id
  and jsonb_typeof(d.snapshot->'questionnaire') = 'object';

create index if not exists astral_orders_review_queue_idx
  on arcane911_private.astral_orders (status, updated_at desc);

create or replace function arcane911_private.queue_paid_astral_order()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare d arcane911_private.purchase_drafts%rowtype; c jsonb; r jsonb;
begin
  if new.product_kind <> 'astral_document' or new.state = 'revoked' then return new; end if;
  select * into d from arcane911_private.purchase_drafts where order_id = new.order_id for update;
  if d.order_id is null or d.product_id <> new.product_id or d.reading_id <> new.reading_id
      or d.amount_total <> new.amount_total then
    raise exception 'purchase_draft_mismatch';
  end if;
  c := d.snapshot->'chart';
  if c is null then raise exception 'astral_snapshot_required'; end if;
  r := public.arcane911_register_astral_order(new.payment_id,new.order_id,new.reading_id,
    c->>'person',d.snapshot->>'email',(c#>>'{birth,date}')::date,(c#>>'{birth,time}')::time,
    c#>>'{location,name}',c#>>'{location,admin1}',c#>>'{location,country}',c#>>'{location,timezone}',
    (c#>>'{location,latitude}')::double precision,(c#>>'{location,longitude}')::double precision);
  if (r->>'registered')::boolean is not true then raise exception 'astral_queue_failed'; end if;
  update arcane911_private.astral_orders
  set birth_utc = (c#>>'{birth,utc}')::timestamptz,
      utc_offset_minutes = (c#>>'{birth,utcOffsetMinutes}')::numeric,
      questionnaire = case
        when jsonb_typeof(d.snapshot->'questionnaire') = 'object' then d.snapshot->'questionnaire'
        else questionnaire
      end,
      updated_at = now()
  where payment_id = new.payment_id;
  return new;
end;
$$;

create or replace function public.arcane911_admin_list_astral_orders(p_status text, p_limit integer)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('orders', coalesce(jsonb_agg(row_to_json(q) order by q."createdAt" desc), '[]'::jsonb))
  from (
    select a.order_id as "orderId", a.full_name as "fullName", a.email,
      a.status, a.draft_version as "draftVersion", a.review_note as "reviewNote",
      a.pdf_path is not null as "pdfReady", a.created_at as "createdAt",
      a.updated_at as "updatedAt", a.delivered_at as "deliveredAt"
    from arcane911_private.astral_orders a
    join arcane911_private.payment_entitlements e on e.payment_id = a.payment_id
    where e.state <> 'revoked'
      and (coalesce(trim(p_status), '') = '' or a.status = trim(p_status))
    order by a.created_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  ) q;
$$;

create or replace function public.arcane911_admin_get_astral_order(p_order_id text)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare a arcane911_private.astral_orders%rowtype; d arcane911_private.purchase_drafts%rowtype;
  generated jsonb;
begin
  select ao.* into a from arcane911_private.astral_orders ao
    join arcane911_private.payment_entitlements e on e.payment_id = ao.payment_id
    where ao.order_id = p_order_id and e.state <> 'revoked';
  if a.payment_id is null then return jsonb_build_object('found',false); end if;
  select * into d from arcane911_private.purchase_drafts where order_id = p_order_id;
  select pr.payload into generated from arcane911_private.paid_results pr
    where pr.payment_id = a.payment_id and pr.scope = 'single' and pr.slot = 0;
  return jsonb_build_object(
    'found',true,
    'order',jsonb_build_object(
      'paymentId',a.payment_id,'orderId',a.order_id,'readingId',a.reading_id,
      'fullName',a.full_name,'email',a.email,'birthDate',a.birth_date,'birthTime',a.birth_time,
      'cityName',a.city_name,'regionName',a.region_name,'countryName',a.country_name,
      'timezone',a.timezone,'latitude',a.latitude,'longitude',a.longitude,
      'status',a.status,'questionnaire',a.questionnaire,'draftVersion',a.draft_version,
      'reviewNote',a.review_note,'pdfReady',a.pdf_path is not null,'pdfPath',a.pdf_path,
      'createdAt',a.created_at,'updatedAt',a.updated_at,'deliveredAt',a.delivered_at
    ),
    'snapshot',d.snapshot,
    'generated',generated,
    'draft',a.draft_payload
  );
end;
$$;

create or replace function public.arcane911_admin_save_astral_draft(
  p_order_id text, p_draft jsonb, p_note text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a arcane911_private.astral_orders%rowtype;
begin
  if p_draft is null or jsonb_typeof(p_draft) <> 'object' or octet_length(p_draft::text) > 500000 then
    return jsonb_build_object('updated',false,'state','invalid_draft');
  end if;
  update arcane911_private.astral_orders
  set draft_payload = p_draft, draft_version = draft_version + 1,
      review_note = left(coalesce(p_note,''),4000), status = 'reviewing', updated_at = now()
  where order_id = p_order_id and status <> 'delivered'
  returning * into a;
  return jsonb_build_object('updated',a.payment_id is not null,'status',coalesce(a.status,'not_found'),
    'draftVersion',coalesce(a.draft_version,0),'updatedAt',a.updated_at);
end;
$$;

create or replace function public.arcane911_admin_request_astral_revision(p_order_id text, p_note text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a arcane911_private.astral_orders%rowtype;
begin
  update arcane911_private.astral_orders
  set status = 'reviewing', review_note = left(coalesce(p_note,''),4000), updated_at = now()
  where order_id = p_order_id and status <> 'delivered'
  returning * into a;
  return jsonb_build_object('updated',a.payment_id is not null,'status',coalesce(a.status,'not_found'),
    'reviewNote',coalesce(a.review_note,''));
end;
$$;

create or replace function public.arcane911_admin_attach_astral_pdf(p_order_id text, p_pdf_path text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a arcane911_private.astral_orders%rowtype;
begin
  if p_pdf_path !~ '^astral/[A-Za-z0-9._/-]+[.]pdf$' or char_length(p_pdf_path) > 500 then
    return jsonb_build_object('updated',false,'state','invalid_pdf_path');
  end if;
  update arcane911_private.astral_orders
  set pdf_path = p_pdf_path, pdf_uploaded_at = now(), status = 'reviewing', updated_at = now()
  where order_id = p_order_id and status <> 'delivered'
  returning * into a;
  return jsonb_build_object('updated',a.payment_id is not null,'status',coalesce(a.status,'not_found'),
    'pdfReady',a.pdf_path is not null);
end;
$$;

create or replace function public.arcane911_admin_finalize_astral_delivery(p_order_id text, p_email_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a arcane911_private.astral_orders%rowtype;
begin
  update arcane911_private.astral_orders
  set status = 'delivered', delivered_at = coalesce(delivered_at,now()), approved_at = coalesce(approved_at,now()),
      delivery_email_id = left(coalesce(p_email_id,''),240), questions_available = 5, updated_at = now()
  where order_id = p_order_id and pdf_path is not null and status <> 'delivered'
  returning * into a;
  if a.payment_id is null then
    select * into a from arcane911_private.astral_orders where order_id = p_order_id and status = 'delivered';
  end if;
  return jsonb_build_object('updated',a.payment_id is not null,'status',coalesce(a.status,'not_found'),
    'questionsAvailable',coalesce(a.questions_available,0),'deliveredAt',a.delivered_at);
end;
$$;

create or replace function public.arcane911_get_astral_pdf_path(
  p_payment_id text, p_order_id text, p_reading_id text
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare a arcane911_private.astral_orders%rowtype;
begin
  select ao.* into a from arcane911_private.astral_orders ao
    join arcane911_private.payment_entitlements e on e.payment_id = ao.payment_id
    where ao.payment_id = p_payment_id and ao.order_id = p_order_id and ao.reading_id = p_reading_id
      and ao.status = 'delivered' and ao.pdf_path is not null and e.state <> 'revoked';
  return jsonb_build_object('authorized',a.payment_id is not null,'path',a.pdf_path);
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
    'pdfReady',o.pdf_path is not null,'downloadAvailable',o.status = 'delivered' and o.pdf_path is not null,
    'answers',coalesce((select jsonb_agg(jsonb_build_object('id',claim_id,'question',input->>'question',
      'answer',payload->>'answer','slot',slot) order by slot) from arcane911_private.paid_results
      where payment_id = p_payment_id and scope = 'astral_question'),'[]'::jsonb));
end;
$$;

create or replace function public.arcane911_astral_fulfillment_health()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('ready',to_regclass('arcane911_private.astral_orders') is not null
    and to_regprocedure('arcane911_private.queue_paid_astral_order()') is not null
    and to_regprocedure('public.arcane911_claim_astral_question(text,text,text,text)') is not null
    and to_regprocedure('public.arcane911_admin_get_astral_order(text)') is not null
    and to_regprocedure('public.arcane911_get_astral_pdf_path(text,text,text)') is not null,'version',3);
$$;

revoke execute on function public.arcane911_admin_list_astral_orders(text,integer) from public,anon,authenticated;
revoke execute on function public.arcane911_admin_get_astral_order(text) from public,anon,authenticated;
revoke execute on function public.arcane911_admin_save_astral_draft(text,jsonb,text) from public,anon,authenticated;
revoke execute on function public.arcane911_admin_request_astral_revision(text,text) from public,anon,authenticated;
revoke execute on function public.arcane911_admin_attach_astral_pdf(text,text) from public,anon,authenticated;
revoke execute on function public.arcane911_admin_finalize_astral_delivery(text,text) from public,anon,authenticated;
revoke execute on function public.arcane911_get_astral_pdf_path(text,text,text) from public,anon,authenticated;
revoke execute on function public.arcane911_get_astral_order_status(text,text,text) from public,anon,authenticated;
revoke execute on function public.arcane911_astral_fulfillment_health() from public,anon,authenticated;
revoke execute on function arcane911_private.queue_paid_astral_order() from public,anon,authenticated;

grant execute on function public.arcane911_admin_list_astral_orders(text,integer) to service_role;
grant execute on function public.arcane911_admin_get_astral_order(text) to service_role;
grant execute on function public.arcane911_admin_save_astral_draft(text,jsonb,text) to service_role;
grant execute on function public.arcane911_admin_request_astral_revision(text,text) to service_role;
grant execute on function public.arcane911_admin_attach_astral_pdf(text,text) to service_role;
grant execute on function public.arcane911_admin_finalize_astral_delivery(text,text) to service_role;
grant execute on function public.arcane911_get_astral_pdf_path(text,text,text) to service_role;
grant execute on function public.arcane911_get_astral_order_status(text,text,text) to service_role;
grant execute on function public.arcane911_astral_fulfillment_health() to service_role;
grant execute on function arcane911_private.queue_paid_astral_order() to service_role;

notify pgrst, 'reload schema';
commit;

-- Verificação esperada: {"ready":true,"version":3}
-- select public.arcane911_astral_fulfillment_health();
