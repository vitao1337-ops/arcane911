# Arcane911 V14 — operação segura do Agent 911

O tarot usa `POST /api/agent-911`. Gemini continua como provedor principal; o segundo modelo Gemini e a OpenAI são paraquedas para falhas recuperáveis. Chaves nunca entram no React.

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

VITE_AGENT911_ENABLED=true
VITE_ASTRO911_ENABLED=true
```

Com `AGENT911_PROVIDER=gemini`, o plano é:

1. `GEMINI_MODEL`;
2. `GEMINI_FALLBACK_MODEL`, somente em falha recuperável;
3. OpenAI, somente se `OPENAI_API_KEY` estiver configurada e os dois candidatos Gemini falharem de forma recuperável.

Falhas recuperáveis incluem quota/`RESOURCE_EXHAUSTED`, timeout, indisponibilidade temporária e respostas HTTP 5xx. Payload inválido, origem proibida e erros 4xx não recuperáveis não acionam outro provedor. `AGENT911_PROVIDER=openai` força OpenAI como único provedor e deve ser usado apenas deliberadamente.

Nunca configure `VITE_GEMINI_API_KEY`, `VITE_OPENAI_API_KEY` ou outra credencial com prefixo `VITE_`.

## Desenvolvimento local gratuito por padrão

```bash
npm ci
npm run dev
```

Sem configuração adicional, o Agent 911 usa um mock local com o mesmo contrato de leitura. O Vite não cria proxy para `/api` e imprime:

```text
[Arcane911 DEV] usando Agent911 mock — nenhuma chamada paga foi realizada.
```

O mock é condicionado a `import.meta.env.DEV`; builds de produção sempre usam o modo conectado. Para habilitar a rota real em DEV, as duas escolhas precisam ser explícitas em `.env.local`:

```env
ARCANE911_DEV_REAL_AI=true
ARCANE911_DEV_API_TARGET=https://seu-preview-controlado.vercel.app
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

Não há retry automático de rede nem loop de reparo. Só existe um reparo estrutural, no mesmo candidato, e o orçamento global nunca ultrapassa três chamadas.

## Logs e custo

Os eventos são:

- `agent911_request_started`
- `agent911_provider_call`
- `agent911_model_fallback`
- `agent911_provider_fallback`
- `agent911_usage`
- `agent911_request_completed`
- `agent911_request_failed`

`agent911_usage` registra provider, modelo, tipo da tiragem, ação, tokens de entrada/saída/raciocínio/total quando fornecidos pelo provider, chamadas, fallback, reparo e duração. `usageByCall` preserva a divisão entre candidatos. Não são registrados pergunta, resposta, nome, e-mail ou chave.

Não há estimativa monetária hardcoded. Custos devem ser calculados externamente a partir de tokens e chamadas, com a tabela de preços vigente.

## Mensagens públicas

O backend distingue `rate_limit`, `provider_quota`, `provider_timeout`, `provider_unavailable`, `provider_invalid_response`, `invalid_payload` e `unknown`. A interface converte os códigos em mensagens neutras e nunca mostra Gemini, OpenAI, stack, chave ou código técnico.

## Checklist após deploy

1. Faça uma abertura de três cartas e confirme um único `agent911_provider_call` quando Gemini responde normalmente.
2. Continue para a Ferradura e confirme uma única chamada para a síntese de sete cartas.
3. Recarregue a leitura pronta e confirme que o cache de sessão evita nova cobrança.
4. Em Preview, simule 429 no Gemini e confirme a sequência principal → modelo fallback → OpenAI, se configurada.
5. Confirme que 429 interno mostra `rate_limit`, enquanto quota termina em `provider_quota`.
6. Confirme `agent911_usage` sem conteúdo privado.
7. Abra o Documento Astral e valide seu fluxo separadamente; esta política não altera o endpoint `/api/astro-911`.
