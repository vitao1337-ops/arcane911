-- USE SOMENTE antes da primeira venda real ou em um projeto Supabase novo.
-- Remove apenas o ledger/RPCs do Arcane911 e prepara uma instalação V4 limpa.
do $$
declare
  fn record;
begin
  for fn in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        p.proname in (
          'arcane911_payment_ledger_health',
          'arcane911_register_entitlement',
          'arcane911_claim_entitlement',
          'arcane911_settle_entitlement',
          'arcane911_claim_bundle_entitlement',
          'arcane911_settle_bundle_entitlement',
          'arcane911_find_entitlement'
        )
        or p.proname like 'arcane911_mp_test_%'
      )
  loop
    execute pg_catalog.format(
      'drop function if exists %I.%I(%s)',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  end loop;
end;
$$;

drop schema if exists arcane911_private cascade;
notify pgrst, 'reload schema';
