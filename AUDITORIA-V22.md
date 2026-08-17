# Arcane911 V22 — auditoria de entrega

Data da run: 17/08/2026 (America/Sao_Paulo).

## Resultado executivo

- A direção visual aprovada foi preservada.
- O bloco claro da resposta específica recebeu texto escuro e estados legíveis, sem redesign e sem `!important`.
- Todas as chamadas de IA ligadas a produtos pagos agora exigem autorização server-side.
- Todas as compras são registradas por webhook Stripe assinado, além da confirmação no retorno do navegador.
- A compra pode ser recuperada pelo código `order-…`, sem conta e sem conteúdo íntimo no banco.
- Termos, Privacidade, Reembolsos e o roteiro operacional foram adicionados.
- O Agent 911 recebeu teto conservador configurável de R$ 1,00 por consulta e métricas estimadas de custo.

## Correções de autorização

A V21 protegia Pergunta ao 911 e Documento Astral, mas ainda havia superfícies incompletas:

1. as sínteses pagas de sete e cinco cartas podiam ser chamadas diretamente;
2. Tiragem Completa e leituras específicas não eram registradas no ledger;
3. a entrega dependia do retorno do navegador ao site;
4. não havia recuperação sem conta.

A V22 fecha esses pontos. A ação técnica antiga `initial_reading` não abre uma rota gratuita de sete cartas. `complete_summary`, `specific_summary` e `follow_up` validam produto, sessão, leitura e número do crédito antes do provider.

## Stripe e recuperação

`api/stripe-webhook.js` valida o corpo bruto com HMAC SHA-256, usa o timestamp assinado para limitar replay, recupera a Checkout Session diretamente no Stripe e registra a autorização de forma idempotente. Os eventos aceitos são `checkout.session.completed` e `checkout.session.async_payment_succeeded`.

`api/order-status.js` permite buscar uma compra por um código de alta entropia, com rate limit. Conteúdo já comprado continua autorizado; créditos de IA consumidos não renascem.

O checkout falha antes de cobrar quando `STRIPE_WEBHOOK_SECRET`, Supabase ou schema V22 não estiverem prontos.

## Banco e privacidade

O SQL V22:

- mantém a tabela em `arcane911_private`;
- habilita e força RLS;
- revoga `PUBLIC`, `anon` e `authenticated`;
- usa funções `security invoker` com `search_path` vazio;
- guarda sessão, Payment Intent, pedido, produto, leitura, valor, moeda, modo test/live, estado e timestamps;
- não guarda pergunta, cartas, resposta, nome, e-mail ou dados natais.

O único projeto Supabase anteriormente disponível pertencia ao Sorriso Marcado e foi preservado. O SQL não foi aplicado externamente. A ativação exige um projeto separado do Arcane911.

## Custo e margem

Antes de cada chamada, a API estima um teto a partir do tamanho do corpo, limite de saída, preço por milhão e câmbio conservador. A soma projetada não pode ultrapassar `AGENT911_MAX_COST_BRL`, cujo padrão é R$ 1,00. O limite de saída máximo foi reduzido a 4.096 tokens.

Essa proteção não prova rentabilidade. Tráfego pago permanece pausado até custos reais, Stripe, impostos, estorno, infraestrutura, suporte e aquisição preservarem margem positiva no pior cenário razoável.

## Estado de verificação

- `npm ci`: aprovado na extração-base; a repetição na extração final foi bloqueada pelo limite operacional do ambiente, sem erro do projeto;
- suíte automatizada: 151 testes aprovados, 0 falhas;
- build de produção: aprovado, 1.617 módulos transformados;
- webhook válido, adulterado e antigo: cobertos;
- recuperação ativa e crédito consumido: cobertos;
- bypass direto de sínteses pagas: coberto;
- contraste do bloco específico e ausência de `!important`: cobertos estaticamente;
- smoke visual automatizado: não executado neste container porque o comando `agent-browser` não está instalado; build, contratos de rota e contraste foram validados, mas o Preview ainda deve receber conferência humana em desktop e mobile;
- credenciais reais: não incluídas;
- ZIP limpo: 115 entradas, sem `node_modules`, `dist`, `.git`, `.env` real ou ZIP aninhado;
- aplicação do SQL, Stripe, Vercel e Git externos: não executada, pois exige as contas e decisões do proprietário.

## Pendências externas obrigatórias

1. criar o Supabase do Arcane911 e executar o SQL;
2. configurar Preview na Vercel;
3. criar webhook Stripe de teste e depois live;
4. preencher operador e suporte;
5. obter revisão jurídica;
6. decidir o preço do Documento Astral;
7. testar a compra ponta a ponta;
8. provar margem antes de tráfego pago.

Consulte `PUBLICACAO-V22.md` e `PAGAMENTOS-SETUP.md`.
