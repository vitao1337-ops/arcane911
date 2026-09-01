# Mercado Pago · configuração do Arcane911 V30

O checkout usa o Payment Brick oficial no navegador e a API de pagamentos no servidor. O Brick exibe apenas cartão de crédito e Pix. Dados completos do cartão não passam pelo código do Arcane911.

## Variáveis Production

```env
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_MODE=production
VITE_MERCADOPAGO_PUBLIC_KEY=
MERCADOPAGO_WEBHOOK_SECRET=
VITE_PUBLIC_SITE_URL=https://arcane911.vercel.app
SUPABASE_URL=
SUPABASE_SECRET_KEY=
ASTRO911_ADMIN_SECRET=
```

`MERCADOPAGO_NOTIFICATION_URL` é opcional. Se vazio, o backend usa `VITE_PUBLIC_SITE_URL + /api/mercadopago-webhook`.

Em produção Vercel, `MERCADOPAGO_MODE=production` é obrigatório. Use esse valor somente depois de copiar a Public Key e o Access Token da seção **Credenciais de produção** do Mercado Pago. O prefixo `APP_USR` sozinho não prova o ambiente; o backend também exige `live_mode=true` em toda resposta do provedor.

Nunca coloque Access Token, segredo de webhook, chave do Supabase, Gemini ou OpenAI em variável `VITE_`.

## Banco

A V29 grava o pedido antes de cobrar e inclui a fila na confirmação. Recuperação e respostas são persistidas em área privada. Código de pedido é uma chave de acesso; não publicar em logs, analytics ou capturas.


Instalação nova:

```sql
-- execute database/arcane911-payment-ledger.sql
-- depois execute database/arcane911-v29.sql
select public.arcane911_payment_ledger_health();
```

Resultado esperado:

```json
{"ready":true,"version":5}
```

O SQL incluído preserva o ledger Mercado Pago atual e cria a fila privada do Documento Astral. `database/RESET-FOR-CLEAN-INSTALL.sql` continua sendo destrutivo e não deve ser executado em banco com vendas reais.

## Webhook

No Mercado Pago, cadastre o evento de pagamentos apontando para:

```text
https://arcane911.vercel.app/api/mercadopago-webhook
```

Copie a chave secreta gerada pelo painel para `MERCADOPAGO_WEBHOOK_SECRET`.

O backend valida `x-signature` usando `data.id`, `x-request-id` e `ts`, depois consulta o pagamento novamente na API antes de registrar a autorização.

## Fluxo

1. Oferta cria um `order-...` local.
2. `/api/checkout` valida produto, configuração e ledger.
3. O usuário abre `/pagamento`.
4. O Payment Brick oferece somente crédito e Pix.
5. `/api/payment` recalcula preço pelo catálogo e cria o pagamento com chave de idempotência determinística.
6. Cartão aprovado segue para confirmação.
7. Pix pendente mostra QR Code e consulta o status até aprovação.
8. `/api/payment-status` consulta o Mercado Pago e registra o entitlement no Supabase.
9. O webhook faz a mesma confirmação server-side caso o navegador feche.

## Segurança

- preço, produto e leitura são validados no servidor;
- `external_reference` é o código do pedido;
- metadata contém apenas IDs técnicos, nunca pergunta, cartas, resposta ou dados natais;
- só `credit_card` e `pix` são aceitos pelo backend;
- o meio enviado pelo navegador é conferido contra `/v1/payment_methods` antes da cobrança;
- retries do mesmo pedido reutilizam a mesma chave de idempotência;
- a liberação exige ambiente real, status `approved`, BRL, valor correto, pedido correto e metadata completa correta.


## Documento Astral premium

- o mapa não é exibido antes da confirmação do pagamento;
- após aprovação, o mapa natal e a leitura automática do Agent911 são liberados imediatamente;
- nome, e-mail e dados natais necessários à entrega humana são registrados em `arcane911_private.astral_orders`, com RLS forçada e acesso apenas por `service_role`;
- a síntese aprofundada em PDF é preparada/revisada por astrólogo e enviada manualmente ao e-mail cadastrado em até 1–2 dias úteis;
- após o envio, o operador marca o pedido como entregue usando `/api/astral-admin-delivery` com `ASTRO911_ADMIN_SECRET`;
- a entrega libera exatamente 5 perguntas pós-síntese no Agent911; cada crédito só é consumido após uma resposta válida.
