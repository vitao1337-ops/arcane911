# Arcane911 V23 — operação segura do Agent 911 e Documento Astral

O tarot usa `POST /api/agent-911` e o Documento Astral usa `POST /api/astro-911`. Nos dois, Gemini continua principal; o segundo modelo Gemini e a OpenAI são paraquedas para falhas recuperáveis. Chaves nunca entram no React.

## Produção

Configure na Vercel:

```env
GEMINI_API_KEY=sua-chave-real
AGENT911_PROVIDER=gemini
GEMINI_MODEL=gemini-3.5-flash
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite

# Opcional: paraquedas depois dos dois modelos Gemini
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-terra

AGENT911_MAX_COST_BRL=1.00
AGENT911_USD_BRL_BUDGET_RATE=6.00
AGENT911_MAX_OUTPUT_TOKENS=4096

VITE_AGENT911_ENABLED=true
VITE_ASTRO911_ENABLED=true
ASTRO911_PROVIDER=gemini

# Obrigatórias antes de cobrar chamadas de IA
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

Com `AGENT911_PROVIDER=gemini`, o plano é:

1. `GEMINI_MODEL`;
2. `GEMINI_FALLBACK_MODEL`, somente em falha recuperável;
3. OpenAI, somente se `OPENAI_API_KEY` estiver configurada e os dois candidatos Gemini falharem de forma recuperável.

Falhas recuperáveis incluem quota/`RESOURCE_EXHAUSTED`, timeout, indisponibilidade temporária e respostas HTTP 5xx. Payload inválido, origem proibida e erros 4xx não recuperáveis não acionam outro provedor. `AGENT911_PROVIDER=openai` força OpenAI como único provedor e deve ser usado apenas deliberadamente.

Nunca configure `VITE_GEMINI_API_KEY`, `VITE_OPENAI_API_KEY` ou outra credencial com prefixo `VITE_`.

## Créditos pagos

Antes de abrir qualquer cobrança, execute `database/arcane911-payment-ledger.sql` no Supabase e configure o webhook do Mercado Pago. A rota de checkout faz um healthcheck antes de abrir o Brick. Sínteses completas, respostas específicas, aprofundamentos e Documento Astral pago sem pagamento válido são recusados antes do provider; uma resposta concluída consome o crédito, enquanto falha ou timeout tenta liberá-lo novamente. O mesmo pagamento consumido não cria outro crédito.

O ledger guarda somente sessão, pedido, produto, leitura, número da pergunta e timestamps técnicos. Pergunta, cartas, resposta, nome e dados natais não são persistidos.

## Desenvolvimento local gratuito por padrão

```bash
npm ci
npm run dev
```

Sem configuração adicional, o Agent 911 e o Documento Astral usam mocks locais com seus contratos reais. O Vite não cria proxy para `/api` e imprime:

```text
[Arcane911 DEV] usando mocks do Tarot e Documento Astral — nenhuma chamada paga foi realizada.
[Arcane911 DEV] tiragem completa e perguntas pagas liberadas somente neste ambiente.
```

Os mocks e a liberação comercial são condicionados a `import.meta.env.DEV`; builds de produção sempre usam o modo conectado e não aceitam esse bypass. Para explicitar o acesso completo local:

```env
ARCANE911_DEV_REAL_AI=false
ARCANE911_DEV_UNLOCK_PAID=true
```

Para habilitar as rotas reais em DEV, as duas escolhas abaixo precisam ser explícitas em `.env.local`:

```env
ARCANE911_DEV_REAL_AI=true
ARCANE911_DEV_API_TARGET=https://arcane911.vercel.app
```

Também é permitido um servidor local HTTP:

```env
ARCANE911_DEV_REAL_AI=true
ARCANE911_DEV_API_TARGET=http://localhost:3000
```

Se `ARCANE911_DEV_REAL_AI=true` estiver sem target, o Vite encerra com erro. Não existe target padrão para produção.

## Rate limit, tempo e cooldown

Os padrões preservam proteção de produção e podem ser sobrescritos no servidor:

```env
ARCANE911_RATE_LIMIT=24
ARCANE911_RATE_WINDOW_MS=600000
AGENT911_PROVIDER_TIMEOUT_MS=18000
AGENT911_TOTAL_TIMEOUT_MS=50000
AGENT911_QUOTA_COOLDOWN_MS=60000
AGENT911_PROVIDER_COOLDOWN_MS=12000
AGENT911_DEDUPE_TTL_MS=120000
AGENT911_MAX_COST_BRL=1.00
AGENT911_USD_BRL_BUDGET_RATE=6.00
AGENT911_MAX_OUTPUT_TOKENS=4096
AGENT911_GEMINI_INPUT_USD_PER_M=1.50
AGENT911_GEMINI_OUTPUT_USD_PER_M=9.00
AGENT911_OPENAI_INPUT_USD_PER_M=2.00
AGENT911_OPENAI_OUTPUT_USD_PER_M=12.00

ASTRO911_RATE_LIMIT=8
ASTRO911_RATE_WINDOW_MS=600000
ASTRO911_PROVIDER_TIMEOUT_MS=35000
ASTRO911_TOTAL_TIMEOUT_MS=55000
ASTRO911_QUOTA_COOLDOWN_MS=60000
ASTRO911_PROVIDER_COOLDOWN_MS=15000
ASTRO911_DEDUPE_TTL_MS=600000
ASTRO911_MAX_OUTPUT_TOKENS=8192
ASTRO911_MAX_COST_BRL=2.00
ASTRO911_USD_BRL_BUDGET_RATE=6.00
ASTRO911_GEMINI_INPUT_USD_PER_M=1.50
ASTRO911_GEMINI_OUTPUT_USD_PER_M=9.00
ASTRO911_OPENAI_INPUT_USD_PER_M=2.00
ASTRO911_OPENAI_OUTPUT_USD_PER_M=12.00
```

- O rate limit interno devolve `429 rate_limit` e `Retry-After`.
- Quota do provedor devolve `503 provider_quota`; não é confundida com o 429 interno.
- Timeout devolve `504 provider_timeout`.
- O cliente bloqueia o botão pelo intervalo seguro; o servidor mantém cooldown por candidato e respeita o maior valor entre a configuração e `Retry-After`.
- Requisições idênticas em andamento compartilham a mesma Promise no cliente e no servidor. Uma resposta pronta fica deduplicada no servidor por um intervalo curto.

## Chamadas por leitura

| Situação | Chamadas externas máximas |
|---|---:|
| Gemini principal válido | 1 |
| Resposta parafraseada, mas estruturalmente válida | 1 |
| Gemini principal falha e Gemini fallback funciona | 2 |
| Dois Gemini falham e OpenAI funciona | 3 |
| JSON realmente truncado/incompleto no primeiro candidato | 2 |
| Clique duplo, StrictMode ou request idêntica em andamento | 1 compartilhada |
| Refresh em até 30 minutos na mesma sessão/leitura | 0, usando `sessionStorage` |

Não há retry automático de rede nem loop de reparo. Só existe um reparo estrutural, no mesmo candidato, e o orçamento global nunca ultrapassa três chamadas. Antes de cada chamada, a rota reserva um custo conservador; se a soma projetada ultrapassar `AGENT911_MAX_COST_BRL`, ela encerra sem chamar o próximo provider.

O Documento Astral segue o mesmo orçamento de três chamadas e possui teto próprio de R$ 2,00 por geração: normalmente uma chamada; duas quando o Gemini principal cai no modelo reserva ou quando um JSON realmente incompleto exige reparo; três apenas quando os dois modelos Gemini falham de modo recuperável e a OpenAI assume. Capítulos fora de ordem e diferenças naturais de redação são normalizados localmente. Sem preço, a produção recusa a geração antes do provider; uma campanha gratuita precisa de `VITE_ASTRO911_ALLOW_FREE_PRODUCTION=true` explícito.

## Logs e custo

Os eventos são:

- `agent911_request_started`
- `agent911_provider_call`
- `agent911_model_fallback`
- `agent911_provider_fallback`
- `agent911_usage`
- `agent911_request_completed`
- `agent911_request_failed`

E, no Documento Astral:

- `astro911_request_started`
- `astro911_provider_call`
- `astro911_model_fallback`
- `astro911_provider_fallback`
- `astro911_usage`
- `astro911_request_completed`
- `astro911_request_failed`

`agent911_usage` e `astro911_usage` registram provider, modelo, tipo da leitura, tokens de entrada/saída/raciocínio/total quando fornecidos pelo provider, chamadas, fallback, reparo, duração, `estimatedCostBrl`, `projectedCostBrl` e `maxCostBrl`. `usageByCall` preserva a divisão entre candidatos. Não são registrados pergunta, resposta, documento, dados natais, nome, e-mail ou chave.

Os preços unitários e o câmbio usados no teto são variáveis de ambiente. Atualize-os quando a tabela dos provedores mudar. A estimativa é um freio técnico, não substitui conferir a fatura real nem provar margem.

## Funil comercial atual

- Tiragem Completa: R$ 19,99 e modal obrigatório antes de seguir. Em produção, o modal encaminha ao checkout configurado; no DEV, o mesmo modal explica o pagamento e oferece bypass sem cobrança.
- Consulta 911 ligada à Ferradura: R$ 5,00 por pergunta, conforme o limite configurado.
- As cinco primeiras perguntas específicas de cinco cartas depois da Tiragem Completa estão incluídas; cada resposta ocupa um slot atômico da compra.
- Pergunta específica adicional depois dos cinco slots: R$ 5,00.
- Pergunta específica avulsa, acessada pela primeira página da tiragem: R$ 10,00.

Os dois valores das perguntas específicas possuem IDs e URLs de checkout separados. O valor de R$ 5,00 exige uma Tiragem Completa paga e essa elegibilidade deve ser confirmada no servidor; o parâmetro de origem do navegador serve apenas para apresentação da oferta.

## Mensagens públicas

O backend distingue `rate_limit`, `provider_quota`, `provider_timeout`, `provider_unavailable`, `provider_invalid_response`, `invalid_payload`, `payment_required`, `payment_credit_unavailable`, `payment_ledger_not_configured`, `payment_ledger_not_ready`, `payment_ledger_unavailable` e `unknown`. A interface converte os códigos em mensagens neutras e nunca mostra Gemini, OpenAI, stack, chave ou código técnico.

## Checklist após deploy

1. Faça uma abertura de três cartas e confirme um único `agent911_provider_call` quando Gemini responde normalmente.
2. Continue para a Ferradura e confirme uma única chamada para a síntese de sete cartas.
3. Recarregue a leitura pronta e confirme que o cache de sessão evita nova cobrança.
4. Em teste controlado local, simule 429 no Gemini e confirme a sequência principal → modelo fallback → OpenAI, se configurada.
5. Confirme que 429 interno mostra `rate_limit`, enquanto quota termina em `provider_quota`.
6. Confirme `agent911_usage` sem conteúdo privado.
7. Abra o Documento Astral e confirme um único `astro911_provider_call` no sucesso normal.
8. Confira `astro911_usage`, cache, dedupe e mensagens neutras de quota/timeout.
9. Em DEV padrão, confira Network sem chamadas para Vercel, Gemini ou OpenAI e atravesse todos os produtos pagos com `ARCANE911_DEV_UNLOCK_PAID=true`.
10. Antes da abertura comercial, conclua uma Pergunta 911 paga em Production controlada e confirme o consumo único no ledger.
11. Reapresente a URL antiga de sucesso e confirme que nenhum crédito novo é criado.
12. Antes de cobrar em produção, siga a ordem completa de `PAGAMENTOS-SETUP.md`.
