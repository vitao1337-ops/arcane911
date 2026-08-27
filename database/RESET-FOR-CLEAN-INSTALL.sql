-- USE SOMENTE antes da primeira venda real ou em um projeto Supabase novo.
-- Remove o ledger privado anterior para permitir uma instalação V24 realmente limpa.
drop schema if exists arcane911_private cascade;
notify pgrst, 'reload schema';
