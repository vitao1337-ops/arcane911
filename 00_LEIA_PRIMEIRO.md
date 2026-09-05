# V31 — revisão humana do Documento Astral

Esta entrega parte da V30 e adiciona a bancada privada em `/admin/mapas`. Leia `REVISAO-HUMANA-V31.md` para o tutorial curto.

No Supabase já atualizado, execute `database/arcane911-v31.sql` e depois `database/arcane911-v31-pdf-bucket.sql`. Em instalação nova, a ordem é: SQL base → V29 → V31 → bucket privado. O healthcheck esperado da fila astral é versão 3.

`REVIEWER_EMAIL=reviewer@example.com` é somente um exemplo e não dispara notificação. Você pode trocar esse e-mail depois na Vercel sem mexer no código.

Nunca execute `RESET-FOR-CLEAN-INSTALL.sql` em produção.
