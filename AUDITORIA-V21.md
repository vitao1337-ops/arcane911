# Arcane911 V21 — auditoria de entrega

Data da run: 17/08/2026 (America/Sao_Paulo).

## Resultado executivo

- O projeto está pronto para `npm ci`, testes, build e entrada em um repositório Git.
- A direção visual da V20 foi preservada; nenhuma folha de estilo foi alterada.
- A V21 corrige uma falha crítica de autorização nos produtos com custo de IA: a autorização não depende mais apenas do `sessionStorage` do navegador.
- Pergunta ao 911 e Documento Astral pago agora exigem um crédito persistente, atômico e de uso único no servidor.
- A cobrança desses produtos falha antes de abrir o Stripe se o banco dedicado não estiver configurado ou se as RPCs não estiverem instaladas.
- O pacote não contém dependências instaladas, build gerado, `.env`, `.git`, caches ou ZIPs aninhados.

## Falha encontrada e correção

Na V20, era possível chamar diretamente o aprofundamento de `/api/agent-911` e o Documento Astral pago sem uma autorização server-side durável. A autorização mantida no navegador também podia ser reapresentada depois de uma sessão Stripe já utilizada.

A V21 adiciona `server/payment-ledger.js` e `database/arcane911-payment-ledger.sql`:

1. `/api/checkout` confirma que o ledger está saudável antes de criar cobranças com custo de IA;
2. `/api/checkout-session` confere a compra diretamente no Stripe e registra uma autorização única;
3. a rota de IA reivindica o crédito atomicamente antes de chamar o provider;
4. sucesso consome o crédito;
5. falha ou timeout libera o crédito para nova tentativa;
6. uma sessão consumida não recria autorização no retorno do checkout.

O identificador da sessão Stripe participa apenas do fingerprint interno. Ele não é incluído nos logs de uso.

## Banco e privacidade

O SQL cria um schema privado, habilita RLS, remove acesso de `PUBLIC`, `anon` e `authenticated` e concede as RPCs somente ao papel server-side. A configuração nova prefere `SUPABASE_SECRET_KEY=sb_secret_...`; a chave legada de `service_role` permanece apenas como transição.

O ledger guarda identificadores técnicos, produto, leitura, número da pergunta, estado e timestamps. Não guarda pergunta, cartas, resposta, nome, nascimento, cidade ou conteúdo do Documento Astral.

O único projeto Supabase conectado durante a auditoria foi identificado como pertencente ao Sorriso Marcado. Ele foi deliberadamente preservado. Portanto, o schema da V21 está pronto e testado estaticamente, mas **não foi aplicado em produção**. A ativação exige um projeto separado do Arcane911 e a execução de `database/arcane911-payment-ledger.sql`.

## Cobrança

Valores mantidos no catálogo confiável:

- Tiragem Completa: R$ 19,99;
- Pergunta ao 911: R$ 5,00;
- pergunta específica após Tiragem Completa paga: R$ 5,00;
- pergunta específica avulsa: R$ 10,00.

O preço do Documento Astral continua deliberadamente indefinido. Um inteiro positivo em `VITE_ASTRO911_PRICE_CENTS` ativa o bloqueio comercial; vazio ou zero mantém a validação aberta e não cria cobrança.

## Contratos adicionados

- follow-up sem pagamento é recusado antes de qualquer chamada de IA;
- Documento Astral pago sem crédito é recusado antes da geração;
- fingerprint de outro mapa não reutiliza uma compra;
- falha do provider devolve o crédito;
- ledger ausente ou incompleto bloqueia o checkout antes do Stripe;
- confirmação Stripe registra o crédito;
- sessão consumida retorna conflito e não recria crédito;
- headers das chaves Supabase nova e legada seguem seus contratos;
- SQL não usa `security definer`, não expõe dados pessoais e restringe privilégios ao backend.

## Validação da run

- `npm ci`: aprovado;
- `npm audit --omit=dev`: 0 vulnerabilidades;
- testes: 142 aprovados, 0 falhas;
- build de produção: aprovado, 1.614 módulos transformados;
- versões de `package.json` e `package-lock.json`: 0.21.0;
- busca de credenciais reais: nenhuma encontrada;
- `!important` em `src`: nenhuma ocorrência;
- lint: o projeto não possui script `lint`;
- smoke visual automatizado: indisponível neste container por ausência do executável do Chromium; o servidor local iniciou e nenhuma superfície visual foi modificada.

## Estado de publicação

Esta entrega não altera banco, variáveis, Stripe, Vercel ou Git remotos. Para ativar com dinheiro real:

1. criar o projeto Supabase do Arcane911;
2. executar o SQL integralmente;
3. configurar `SUPABASE_URL`, `SUPABASE_SECRET_KEY` e `STRIPE_SECRET_KEY` primeiro em Preview;
4. testar compra, consumo, repetição da URL e recuperação após falha;
5. somente então replicar em Production e publicar a V21.

O roteiro operacional completo está em `PAGAMENTOS-SETUP.md`.

## Limites deliberados

O consumo de créditos de IA agora é persistente e atômico. Ainda não existem conta do usuário, recuperação entre dispositivos, webhook Stripe para entrega assíncrona ou reembolso automatizado. Essas evoluções devem preceder escala de tráfego pago.
