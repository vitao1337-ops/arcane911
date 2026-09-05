-- Arcane911 V31: bucket privado e restrito aos PDFs revisados.
-- Execute depois de database/arcane911-v31.sql.
-- Idempotente: pode ser executado novamente sem apagar arquivos existentes.
begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'arcane911-astral-pdfs',
  'arcane911-astral-pdfs',
  false,
  2700000,
  array['application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

commit;

-- Verificação esperada:
-- public = false, file_size_limit = 2700000,
-- allowed_mime_types = {application/pdf}
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'arcane911-astral-pdfs';
