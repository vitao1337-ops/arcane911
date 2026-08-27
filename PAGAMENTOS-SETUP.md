# Mercado Pago · configuração do Arcane911 V24

O checkout usa o Payment Brick oficial no navegador e a API de pagamentos no servidor. O Brick exibe apenas cartão de crédito e Pix. Dados completos do cartão não passam pelo código do Arcane911.

## Variáveis Production

```env
MERCADOPAGO_ACCESS_TOKEN=
VITE_MERCADOPAGO_PUBLIC_KEY=
MERCADOPAGO_WEBHOOK_SECRET=
VITE_PUBLIC_SITE_URL=https://arcane911.vercel.app
SUPABASE_URL=
SUPABASE_SECRET_KEY=
```

`MERCADOPAGO_NOTIFICATION_URL` é opcional. Se vazio, o backend usa `VITE_PUBLIC_SITE_URL + /api/mercadopago-webhook`.

Nunca coloque Access Token, segredo de webhook, chave do Supabase, Gemini ou OpenAI em variável `VITE_`.

## Banco

Instalação nova:

```sql
-- execute database/arcane911-payment-ledger.sql
select public.arcane911_payment_ledger_health();
```

Resultado esperado:

```json
{"ready":true,"version":4}
```

Se existe uma instalação antiga e ainda não houve venda real, use `database/RESET-FOR-CLEAN-INSTALL.sql` antes do ledger V24. Não rode reset depois de começar a vender.

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
- a liberação exige status `approved`, BRL, valor correto, pedido correto e metadata correta.
