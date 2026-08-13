# Auditoria V14 — estabilização, limpeza e custo

## Escopo

Run cirúrgica sobre o motor existente. Não houve redesign, troca de cartas, mudança do mecanismo de seleção, reestruturação ampla de `App.jsx`, migração de CSS ou alteração de checkout.

## Diagnóstico de chamadas antes da run

O caminho normal já fazia uma chamada quando o primeiro modelo entregava uma leitura aprovada. O custo imprevisível surgia em três pontos:

- qualquer reprovação de `auditAgent911Response`, inclusive lexical/estilística, iniciava uma segunda geração completa;
- cada geração podia tentar Gemini principal e Gemini fallback, chegando a quatro chamadas externas em um único pedido;
- não havia cooldown compartilhado nem deduplicação server-side para requests iguais; cliques/requisições repetidos podiam iniciar trabalho adicional.

O cliente já tinha um cache de sessão básico, mas sem expiração explícita. O Vite apontava `/api` silenciosamente para produção, portanto teste visual local podia consumir quota real.

## Resultado de chamadas depois da run

| Fluxo | Chamadas pagas |
|---|---:|
| Abertura ou Ferradura válida no Gemini principal | 1 |
| Aprofundamento válido | 1 |
| Paráfrase/variação estilística com schema íntegro | 1 |
| Gemini principal recuperável → Gemini fallback válido | 2 |
| Gemini inteiro recuperável → OpenAI válido | 3 |
| Resposta estruturalmente inválida no primeiro candidato → reparo válido | 2 |
| Requisição idêntica simultânea | 1 compartilhada |
| Resposta idêntica repetida no TTL server-side | 0 |
| Refresh da mesma leitura no TTL da sessão | 0 |

O orçamento global é três chamadas e há no máximo um reparo. Não existem retries automáticos de rede.

## Auditoria e normalização

O parser primeiro tenta JSON direto e depois extrai localmente o objeto entre o primeiro `{` e o último `}`. Sugestões indevidas em resumos são normalizadas localmente, e `usedCardSlugs` é reconstruído a partir das seções válidas.

Reprovações por abertura genérica, paráfrase da pergunta, ordem estilística ou menção lexical incompleta das cartas viraram avisos silenciosos: a resposta segue se schema e mesa estão íntegros. Reparo por IA fica restrito a JSON truncado/impossível, campos essenciais ausentes, seções inválidas ou grounding estrutural incompleto. Segurança, carta inventada e certeza proibida bloqueiam a resposta sem nova geração.

## Resiliência e erros

- Rate limit do Arcane: `429 rate_limit`.
- Quota externa: `503 provider_quota`.
- Timeout: `504 provider_timeout`.
- Indisponibilidade: `503 provider_unavailable`.
- Resposta inválida: `502 provider_invalid_response`.
- Payload do cliente: `400 invalid_payload`.

Somente quota, timeout, indisponibilidade temporária e 5xx atravessam o plano de fallback. Cooldowns são específicos por provider/model e respeitam `Retry-After`. O cliente também bloqueia nova tentativa durante o intervalo informado.

## Tokens e orçamento de saída

O log `agent911_usage` agrega metadados retornados pelos providers e mantém `usageByCall`. O orçamento de saída foi ajustado de forma conservadora:

- abertura/resumo de 3 cartas: 4096 (mantido);
- resumo completo de 7 cartas: 6144 → 5120;
- aprofundamento de 7 cartas: 8192 → 6144;
- aprofundamento de 3 cartas: 6144 → 4096.

Não foi criado cálculo em moeda: preços mudam, enquanto tokens e número de chamadas são medidas confiáveis.

## Limpeza comprovada

- Removidos `createAstrologyAgentContext`, `pickSpread`, `buildCompleteSpread`, `hashString` e `mulberry32` do fluxo de tarot após busca global confirmar ausência de uso de produto.
- Mantido `createRandomDrawPool`, o Fisher–Yates usado pela seleção atual.
- Mantido `agent911Memory.js`, documentado como infraestrutura reservada de conta/memória consentida.
- Mantido checkout e scaffold comercial.
- Removidos CSS legado `.agent911-bridge`, `.agent911-mark`, `.agent911-copy`, `.agent911-readiness`, `.complete-synthesis-card` e variáveis sem referência global.
- Mantido `.deck-order strong`, pois existe no JSX atual.
- Consolidado `hero-caption` mobile e corrigida a precedência do footer pequeno sem `!important`.

## Segurança

Segredos permanecem server-side. `.env` e variantes estão ignorados, `.env.example` não contém valores reais, payload tem limite de 64 KB, CORS mantém mesma origem/allowlist, e os logs omitem conteúdo da pergunta e da leitura. Mock depende de build DEV e não pode produzir leitura falsa em produção.

## Verificação desta entrega

- `npm ci`: concluído.
- `npm test`: 89/89 testes aprovados.
- `npm run lint`: indisponível; o projeto não possui script `lint`.
- `npm run build`: concluído após mover o `dist` anterior para fora do projeto; o `dist` novo referencia somente arquivos existentes do build atual.
- Preview HTTP: landing, tiragens, mapa astral e quatro páginas específicas responderam 200.
- DEV padrão: módulo configurado como mock, sem target de produção no código servido.
- DEV explícito: opt-in configurado como live e exatamente um POST atravessou o proxy para um target local controlado.
- Chamada paga real: não executada, pois o ambiente não possui chave Gemini/OpenAI e esta run não publicou um Preview externo.
- Verificação visual automatizada: bloqueada pelo sandbox, que não monta `/proc` para o daemon do navegador e não possui Chromium. As invariantes CSS, ausência de `!important`, footer/hero mobile e rotas foram verificadas automaticamente; a inspeção pixel a pixel nas cinco larguras permanece no checklist manual.
