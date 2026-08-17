# Arcane911 V22 — ativação segura de pagamentos

Esta versão só abre uma cobrança quando o livro-caixa e o webhook estão configurados. O retorno do navegador continua útil para liberar a tela imediatamente, mas a entrega oficial ocorre pelo webhook assinado do Stripe.

## O que já está implementado

- preços recalculados no servidor, nunca aceitos do navegador;
- Stripe Checkout em BRL;
- webhook com validação HMAC do corpo bruto, tolerância contra replay e busca posterior da sessão no Stripe;
- registro idempotente de todas as compras no Supabase;
- consumo atômico dos créditos de IA e devolução do crédito quando o provider falha;
- bloqueio server-side da Ferradura, pergunta específica, Pergunta ao 911 e Documento Astral pago;
- recuperação sem conta pelo código `order-…`;
- nenhuma pergunta, carta, resposta, nome, e-mail ou dado natal no livro-caixa.

## Valores atuais

| Produto | Valor | Regra |
|---|---:|---|
| Tiragem Completa | R$ 19,99 | Uma Ferradura ligada à abertura atual |
| Pergunta ao 911 | R$ 5,00 | Um crédito de IA, até três por Ferradura |
| Pergunta específica após a Ferradura | R$ 5,00 | Exige a Tiragem Completa paga da mesma leitura |
| Pergunta específica avulsa | R$ 10,00 | Uma mesa direcionada de cinco cartas |
| Documento Astral 911 | A definir | Vazio/zero mantém a validação aberta e não cobra |

Não defina um preço para o Documento Astral até a decisão comercial ser aprovada.

## Passo 1 — criar o Supabase exclusivo do Arcane911

1. Crie um projeto novo no Supabase. Não use o projeto do Sorriso Marcado.
2. Abra **SQL Editor**.
3. Cole e execute todo o arquivo `database/arcane911-payment-ledger.sql`.
4. Execute esta verificação:

```sql
select public.arcane911_payment_ledger_health();
```

5. O resultado obrigatório é:

```json
{"ready": true, "version": 2}
```

6. Copie a URL do projeto.
7. Em **API Keys**, crie ou copie uma chave secreta `sb_secret_...` para o backend.

O SQL habilita e força RLS, remove acesso de `PUBLIC`, `anon` e `authenticated`, usa funções `security invoker` e concede execução somente ao `service_role` do servidor.

## Passo 2 — preparar o Preview na Vercel

Em **Project → Settings → Environment Variables**, configure primeiro para **Preview**:

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...

STRIPE_SECRET_KEY=sk_test_...

GEMINI_API_KEY=...
AGENT911_PROVIDER=gemini
GEMINI_MODEL=gemini-3.5-flash
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-terra

AGENT911_MAX_COST_BRL=1.00
AGENT911_USD_BRL_BUDGET_RATE=6.00
AGENT911_MAX_OUTPUT_TOKENS=4096

VITE_LEGAL_OPERATOR_NAME=NOME LEGAL OU EMPRESARIAL
VITE_SUPPORT_EMAIL=SEU_EMAIL_DE_SUPORTE
VITE_PUBLIC_SITE_URL=https://SEU-PREVIEW.vercel.app
```

Não use o prefixo `VITE_` em Stripe, Supabase, Gemini ou OpenAI. Variáveis `VITE_` são públicas por definição.

Faça um deploy de Preview. Neste primeiro deploy, o checkout continuará bloqueado porque ainda falta o segredo do webhook. Isso é esperado.

## Passo 3 — criar o webhook de teste no Stripe

1. No Stripe em modo de teste, abra **Workbench/Developers → Webhooks**.
2. Crie um endpoint com esta URL:

```text
https://SEU-PREVIEW.vercel.app/api/stripe-webhook
```

3. Assine estes eventos:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
```

4. Copie o segredo `whsec_...`.
5. Volte à Vercel e adicione em **Preview**:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_WEBHOOK_TOLERANCE_SECONDS=300
```

6. Faça outro deploy de Preview.
7. No Stripe, envie um evento de teste e confirme resposta HTTP `200`.

Não use o segredo do Stripe CLI em produção. Cada endpoint possui seu próprio `whsec_...`.

## Passo 4 — publicar os documentos legais

1. Abra no Preview:
   - `/termos`
   - `/privacidade`
   - `/reembolsos`
   - `/recuperar-compra`
2. Confirme que o nome do operador e o e-mail estão corretos.
3. Peça revisão jurídica do texto e preencha os dados empresariais exigidos para sua operação. O conteúdo incluído é uma base operacional, não parecer jurídico.
4. Cadastre no Stripe a URL pública dos Termos e os dados públicos da empresa.
5. Somente depois disso, ative:

```env
STRIPE_REQUIRE_TERMS_ACCEPTANCE=true
```

6. Faça novo deploy.

## Passo 5 — executar a compra de teste completa

Use o cartão de teste do Stripe `4242 4242 4242 4242`, uma data futura e qualquer CVC permitido no modo de teste.

Valide nesta ordem:

1. faça uma leitura gratuita;
2. compre a Tiragem Completa;
3. confirme a volta à mesma leitura;
4. confirme o evento `stripe_webhook_fulfilled` nos logs da Vercel;
5. no Supabase, confirme uma linha com `amount_total = 1999`, `currency = brl` e `state` válido;
6. copie o código `order-…` exibido no checkout;
7. abra `/recuperar-compra` em outra aba e restaure a autorização;
8. compre uma Pergunta ao 911, receba a resposta e confirme `state = consumed`;
9. reapresente a URL de sucesso e confirme que nenhum novo crédito é criado;
10. simule uma falha do provider e confirme que o crédito volta a `active`;
11. teste a pergunta específica de R$ 5 dentro da Ferradura e a de R$ 10 fora dela;
12. teste cancelamento do checkout e retorno à experiência intacta.

O código recupera autorização. Ele não reconstrói conteúdo íntimo apagado ou criado em outro dispositivo; essa separação é deliberada.

## Passo 6 — conferir segurança e observabilidade

Nos logs, confirme:

- nenhuma pergunta, resposta, carta, nome, e-mail, nascimento ou chave;
- `stripe_webhook_fulfilled` para cada compra paga;
- `agent911_usage` com chamadas, tokens, custo estimado e teto;
- uma chamada normal por síntese e no máximo três tentativas em fallback;
- nenhuma chamada de IA para requisição paga recusada.

Os eventos comerciais já são emitidos em `window.dataLayer` e `arcane911:commercial-event`. Nenhum rastreador externo foi instalado silenciosamente. Se conectar analytics, faça isso junto com consentimento e revisão de privacidade.

## Passo 7 — promover para produção

Somente depois do Preview aprovado:

1. replique Supabase, identificação pública e configurações de IA para **Production**;
2. troque `STRIPE_SECRET_KEY` por `sk_live_...`;
3. crie um endpoint de webhook separado apontando para o domínio final;
4. use o novo `whsec_...` de produção;
5. confira as URLs legais no domínio final;
6. faça deploy de produção;
7. realize uma compra real de baixo risco e reembolse manualmente se fizer parte do teste operacional;
8. monitore Stripe, webhook, ledger e logs durante a validação.

## Regra de margem antes de tráfego pago

O tráfego pago permanece pausado. O Agent 911 possui um teto técnico conservador de R$ 1,00 por consulta, mas isso não prova margem por si só.

Antes de anunciar:

1. extraia o custo real dos provedores e compare com `agent911_usage`;
2. some Stripe, impostos, estornos, infraestrutura, suporte e aquisição;
3. calcule a margem no pior cenário razoável, incluindo fallback e reembolso;
4. só libere tráfego quando a margem unitária continuar positiva nesse cenário.

Se o preço do provedor ou o câmbio mudar, atualize os quatro preços por milhão e a taxa conservadora nas variáveis de ambiente antes do próximo deploy.

## Reembolso e suporte

A V22 não estorna automaticamente. Faça a análise no Stripe usando o código do pedido e mantenha um procedimento humano para cobrança duplicada, falha de entrega e direito aplicável do consumidor. Nunca peça número completo do cartão ou CVC por e-mail.

## Diagnóstico rápido

| Erro | Ação |
|---|---|
| `webhook_not_configured` | Configure o `whsec_...` correto e redeploy |
| `payment_ledger_not_configured` | Configure URL e chave secreta do Supabase |
| `payment_ledger_not_ready` | Execute o SQL V22 e confirme health version 2 |
| `payment_ledger_unavailable` | Verifique Supabase, rede e chave; o crédito não deve ser queimado |
| `payment_credit_unavailable` | O crédito de IA já foi consumido ou não pertence à leitura |
| `purchase_not_found` | Confira o código `order-…` e o modo test/live |
| `purchase_processing` | Aguarde o processamento e tente a recuperação novamente |
| `payment_mismatch` | Confira produto, valor, moeda, leitura e metadata no Stripe |
