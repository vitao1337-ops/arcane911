# V31.2 — Arcane911 mais leve + revisão humana

Esta entrega mantém integralmente a V31 e corrige o carregamento lento sem alterar a identidade visual. O motor astronômico agora entra somente depois da primeira interação no formulário; Agent911, cartas laterais, cidades e cache da Vercel também foram ajustados. Leia `REVISAO-HUMANA-V31.md` para o tutorial curto da bancada privada em `/admin/mapas`.

No Supabase já atualizado, execute `database/arcane911-v31.sql` e depois `database/arcane911-v31-pdf-bucket.sql`. Em instalação nova, a ordem é: SQL base → V29 → V31 → bucket privado. O healthcheck esperado da fila astral é versão 3.

`REVIEWER_EMAIL=reviewer@example.com` é somente um exemplo e não dispara notificação. Você pode trocar esse e-mail depois na Vercel sem mexer no código.

Nunca execute `RESET-FOR-CLEAN-INSTALL.sql` em produção.
