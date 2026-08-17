# Arcane911 — V22 · entrega comercial recuperável

Primeira versão multipágina do Projeto Arcano, criada a partir do DNA visual do Sorriso Marcado e das 22 cartas originais dos Arcanos Maiores.

## Rotas

- `/`: landing original, com ritual integrado, história e os 22 Arcanos.
- `/tiragem-gratis`: ritual focado de três cartas.
- `/tiragem-completa`: segundo ritual e Ferradura de sete cartas em página própria, preservando pergunta e cartas da abertura.
- `/mapa-astral`: mapa natal completo com cálculo local e Documento Astral 911.
- `/leituras/amor`, `/leituras/caminhos`, `/leituras/trabalho`, `/leituras/decisao` e `/leituras/interior`: leituras completas de cinco cartas com pergunta editável, checkout contextual e síntese 911.
- `/recuperar-compra`: restaura a autorização pelo código `order-…`, sem conta e sem guardar a pergunta.
- `/termos`, `/privacidade` e `/reembolsos`: documentos públicos para a operação comercial.

## O que já funciona

- Escolha de intenção e pergunta livre.
- Embaralhamento Fisher–Yates dos 22 Arcanos com aleatoriedade criptográfica do navegador.
- Proteção contra mesas consecutivas quase idênticas, sem prender cartas a posições recorrentes.
- Seleção manual de três cartas, em ordem.
- Leitura em três posições: A Raiz, O Espelho e O Movimento.
- Aprofundamento premium em uma Ferradura clássica de sete cartas por **R$ 19,99**, com acesso integral liberado no DEV.
- Segundo baralho real: os 19 Arcanos restantes são reorganizados em uma nova mesa e o usuário escolhe manualmente as quatro cartas adicionais.
- Continuidade real entre as etapas: as três cartas escolhidas ocupam origem, presente e melhor ação; quatro cartas únicas completam influência oculta, nó central, campo externo e direção provável.
- Mapa visual em Ferradura e leitura organizada em três camadas equilibradas de 2–3–2 cartas.
- Interpretações autorais com luz, sombra e convite prático.
- Sínteses de abertura e de Ferradura para Caminhos, Amor, Trabalho, Decisão e Eu por dentro.
- Diário local com até 24 leituras neste dispositivo.
- Diário e compartilhamento reconhecem tanto a abertura de três cartas quanto a leitura completa de sete.
- Galeria completa dos 22 Arcanos, com modal de significado e simbologia.
- Galeria ampliada em composição ritual 7–8–7 no desktop, quatro por fileira no tablet com fechamento centralizado e pares completos no celular.
- Nomes e algarismos calibrados pelo centro real das placas e medalhões das cartas.
- Eixo único de 50% para nome, algarismo, carta e legenda, com escala própria por comprimento do nome no desktop e no mobile.
- Molduras de vidro renovadas nas cartas principais e na coleção completa.
- Painéis noturnos lapidados, com constelações, traços e sigilos em rosé/champagne; somente estrelas pequenas respiram em baixa frequência.
- Campo místico refeito sem rotação de áreas grandes, blur animado, feixe atravessando o painel ou sombra pulsante.
- Seções abaixo da dobra usam renderização sob demanda e a entrada da galeria não anima mais o vidro com blur.
- Transição contextual da abertura de três cartas para a Ferradura completa, preservando a mesa e encaminhando produção ao Stripe Checkout.
- Memória de sessão entre as páginas gratuita e completa, sem colocar a pergunta na URL.
- Página de Mapa Astral com busca de cidade, fuso histórico, Sol, Lua, Ascendente, Meio do Céu, dez planetas, doze casas e aspectos maiores.
- Cálculo tropical em Casas Iguais com verificação independente das longitudes planetárias pelo Astronomy Engine.
- Resultado astrológico serializável, compartilhável e guardado somente no navegador.
- Documento Astral com alvo editorial de aproximadamente 1.800–2.600 palavras: abertura, retrato central, essência, afetos, vocação, tensões, integração, cinco práticas e cinco perguntas de reflexão.
- O motor interpretativo recebe apenas primeiro nome e fatos calculados do mapa; data, horário e cidade não saem do navegador nessa chamada.
- Structured Output, normalização local e auditoria recusam posições inventadas e determinismo sem cobrar nova chamada por paráfrase ou ordem diferente dos capítulos.
- Documento guardado somente na sessão por até 12 horas, chamadas simultâneas deduplicadas no cliente e servidor e botão para imprimir ou salvar como PDF.
- Gemini permanece principal no Documento Astral; Gemini reserva e OpenAI opcional entram somente em falhas recuperáveis. Há cooldown, `Retry-After`, no máximo um reparo e orçamento global de três chamadas.
- `astro911_usage` registra tokens, chamadas, fallback, reparo e duração sem registrar dados natais ou conteúdo do documento.
- O preço próprio do Documento Astral não foi inventado: produto, ID e valor estão no catálogo compartilhado. Um valor positivo ativa automaticamente o bloqueio, o checkout hospedado e a confirmação server-side antes da chamada de IA.
- Carregamento sob demanda: o motor astral não pesa no JavaScript inicial da landing.
- Cinco rotas funcionais de perguntas específicas com embaralhamento, escolha manual, cinco posições, leitura local e síntese 911: R$ 5,00 depois da Tiragem Completa e R$ 10,00 na compra avulsa.
- Depois da abertura e da Ferradura aparece somente a oferta correspondente à intenção escolhida; Amor não mostra Trabalho, e “Eu por dentro” possui sua própria estrutura.
- Formulário astral renovado com nome completo e superfícies clicáveis de data e horário.
- Microtipografia ampliada somente no desktop, preservando fontes, blocos e direção visual.
- Síntese 911 automática nas leituras de três e sete cartas, pessoal e ancorada na pergunta, sem clique extra nem cadastro.
- Gemini conectado por padrão no mesmo endpoint seguro, usando `gemini-3.5-flash` e Structured Output.
- Segundo modelo Gemini automático em `gemini-3.5-flash-lite` quando o principal atinge quota ou fica temporariamente indisponível.
- No modo conectado, a interface espera a leitura real do Gemini e nunca exibe um texto local provisório para substituí-lo depois.
- Falha conectada preserva cartas e pergunta, diferencia rate limit, quota, timeout e resposta inválida, e respeita cooldown antes de liberar nova tentativa.
- Dez direções de voz escolhidas pelo contexto, contrato de personalização e auditoria anti-fórmula reduzem aberturas e cadências repetidas.
- Chave simples **Sem rodeios OFF/ON** antes da tiragem. Desligada, a voz é acolhedora; ligada, usa o contrato incisivo. A chave acompanha a sessão e a Consulta 911.
- A interface declara que essa chave muda apenas o tom e nunca interfere no embaralhamento, nas cartas escolhidas ou na tiragem.
- No modo **Sem rodeios**, perguntas binárias recebem uma direção da mesa em **SIM**, **NÃO** ou **INCONCLUSIVA**; perguntas abertas começam por **Na mesa:**.
- A direção binária continua simbólica e condicional. Alegações de traição, doença, crime, gravidez ou intenção secreta são marcadas como **INCONCLUSIVA**, nunca apresentadas como prova.
- A abertura conectada precisa usar as três cartas pelo nome; a Ferradura precisa articular pelo menos cinco cartas e o aprofundamento conecta ao menos duas.
- OpenAI preservada como paraquedas opcional: só entra depois de falhas recuperáveis dos dois candidatos Gemini.
- Uma resposta semanticamente válida e parafraseada não dispara nova geração; somente falha estrutural pode receber um reparo, sem loops.
- Requisições idênticas são deduplicadas no cliente e no servidor, e a leitura pronta tem cache curto de sessão para evitar cobrança em refresh.
- Logs de uso registram tokens, chamadas, modelo, fallback, reparo e duração sem registrar pergunta ou conteúdo da leitura.
- Falha do modo conectado não consome uma pergunta da Consulta 911. Cada pergunta custa **R$ 5,00**, adquirida individualmente, com até três perguntas ligadas à mesma Ferradura.
- Uma única síntese por tiragem; o antigo bloco genérico duplicado foi removido.
- Consulta 911 separada da leitura, com cadastro solicitado somente ao entrar e até três aprofundamentos conectados à Ferradura.
- Leituras específicas removidas da abertura gratuita e reposicionadas depois da consulta como alternativa direta de menor escopo.
- Bíblia canônica própria dos 22 Arcanos e das 231 combinações possíveis entre pares; o servidor reconstrói a mesa e não confia em significados enviados pelo navegador.
- Auditoria automática rejeita cartas inventadas, cartas omitidas, certezas deterministas e afirmações sem sustentação na tiragem.
- Memória opcional, privada neste dispositivo, com consentimento explícito e exclusão integral em dois passos.
- Chaves de Gemini ou OpenAI mantidas exclusivamente na função server-side da Vercel; nenhuma credencial é enviada ao navegador.
- Catálogo comercial centralizado: Tiragem Completa a **R$ 19,99**, Pergunta ao 911 a **R$ 5,00**, pergunta específica a **R$ 5,00** dentro da Ferradura e **R$ 10,00** fora dela. O servidor cria e valida sessões hospedadas do Stripe sem confiar em preço ou texto vindo do navegador.
- Livro-caixa privado no Supabase; nos produtos com IA, o crédito é reivindicado atomicamente, consumido após sucesso e liberado novamente quando o provider falha.
- Livro-caixa V22 para **todos** os produtos pagos, com valor, moeda, modo teste/real e Payment Intent conferidos.
- Webhook Stripe assinado com corpo bruto e tolerância contra replay; a entrega não depende de o cliente voltar à página de sucesso.
- Recuperação por código de pedido e armazenamento técnico do pedido pendente por até 24 horas.
- Sínteses de sete e cinco cartas agora também exigem crédito server-side; a antiga ação técnica de sete cartas não abre bypass gratuito.
- Teto conservador configurável de **R$ 1,00 por consulta do Agent 911**, com custo estimado por chamada nos logs.
- Contraste corrigido no bloco claro da resposta específica, sem redesign e sem `!important`.
- Chamadas diretas a aprofundamentos pagos são recusadas sem crédito; reapresentar uma sessão Stripe consumida não recria autorização.
- Pré-voo do banco antes do Stripe: pergunta 911 e Documento Astral pago não abrem cobrança se as funções do ledger não estiverem instaladas.
- O CTA da Tiragem Completa sempre abre o modal de acesso, inclusive no DEV; produção exige pagamento confirmado e o DEV apenas oferece um bypass explícito sem cobrança.
- O modal de compra foi mantido compacto, sem rolagem interna, com adaptação por largura e altura de viewport.
- Layout responsivo, navegação por teclado e redução de movimento.
- Zoom de interface bloqueado no mobile, campos com 16 px para evitar aproximação automática no iPhone e regras globais contra quebra de palavras.

## Rodar localmente

Requer Node.js 20.19+.

```bash
npm ci
npm run dev
```

O Vite inicia em mock local e não cria proxy para produção. Assim, testes visuais custam zero chamadas de IA. Para testar a rota real deliberadamente, configure os dois campos em `.env.local` e reinicie o servidor:

```env
ARCANE911_DEV_REAL_AI=true
ARCANE911_DEV_API_TARGET=https://seu-preview-controlado.vercel.app
```

O DEV também libera Ferradura, perguntas e qualquer produto pago sem checkout:

```env
ARCANE911_DEV_UNLOCK_PAID=true
```

Esse bypass depende simultaneamente de `import.meta.env.DEV`; Preview e produção ignoram a liberação. Se o opt-in de IA real estiver ativo sem target, o Vite falha de forma explícita. Builds de produção nunca usam mock.

Para validar a versão de produção:

```bash
npm test
npm run build
npm run preview
```

## Estrutura

- `src/App.jsx`: navegação, landing, estados do ritual e continuidade entre páginas.
- `src/styles.css`: direção visual, animações e responsividade.
- `src/data/tarot.js`: conteúdo dos 22 Arcanos.
- `src/data/products.js`: catálogo editorial e posições das leituras específicas.
- `src/lib/reading.js`: embaralhamento Fisher–Yates, montagem pelas escolhas manuais, leituras e textos compartilháveis.
- `src/lib/astrology.js`: cálculo natal, dupla verificação, interpretações e busca de cidades.
- `src/pages/AstralMapPage.jsx`: formulário, mandala, leitura calculada e entrada do documento.
- `src/components/Astral911Document.jsx`: estados, capítulos, práticas, cópia e impressão do documento premium.
- `src/lib/astro911.js`: contexto mínimo, cache, deduplicação e cliente seguro do documento.
- `src/lib/astro911Fallback.js`: Documento Astral local completo usado somente no DEV gratuito.
- `src/config/astro911.js`: ativação e endpoint público sem segredo.
- `src/pages/SpecificReadingPage.jsx`: compra, sorteio manual, revelação e resultado das leituras específicas.
- `src/pages/PurchaseRecoveryPage.jsx`: recuperação de compra por código técnico.
- `src/pages/LegalPage.jsx`: Termos, Privacidade e Reembolsos.
- `src/components/NatalWheel.jsx`: mandala SVG responsiva.
- `src/config/productCatalog.js`: IDs e preços confiáveis compartilhados pelo cliente e servidor.
- `src/config/commerce.js`: apresentação comercial e bypass exclusivo do DEV.
- `src/config/sales.js`: apresentação comercial da Tiragem Completa.
- `src/config/agent911.js`: ativação, endpoint e oferta por pergunta do Agente 911.
- `src/config/agent911ReadingModes.js`: posturas disponíveis, modo padrão e normalização compartilhada entre navegador e servidor.
- `src/components/Agent911Summary.jsx`: síntese automática, espera ritual, cache conectado e nova tentativa sem texto provisório.
- `src/components/Agent911Consultation.jsx`: cadastro progressivo e conversa de três perguntas.
- `src/lib/agent911Fallback.js`: leitura essencial ancorada para indisponibilidade da API.
- `src/lib/agent911Session.js`: cache curto por leitura/sessão e cadastro beta local.
- `src/agent911.css`: camada visual isolada do agente, sem alterar o restante do site.
- `src/lib/checkout.js`: criação, confirmação e autorização comercial de sessão no navegador.
- `src/lib/agent911.js`: contexto, guardrails e cliente seguro da rota server-side.
- `src/lib/agent911Memory.js`: módulo de memória consentida preservado para a futura conta server-side; não é acionado na síntese automática.
- `server/tarot-canon.js`: Bíblia 911 dos 22 Arcanos e relações de pares.
- `server/checkout-core.js`: catálogo confiável, criação Stripe e verificação server-side da compra.
- `server/payment-ledger.js`: registro, reivindicação e consumo atômico de créditos pagos pelo backend.
- `server/stripe-webhook.js`: verificação criptográfica do webhook Stripe.
- `database/arcane911-payment-ledger.sql`: schema privado, RLS, privilégios mínimos e RPCs do livro-caixa.
- `api/checkout.js`, `api/checkout-session.js`, `api/stripe-webhook.js` e `api/order-status.js`: criação, confirmação, entrega assíncrona e recuperação da compra.
- `server/agent911-core.js`: validação, prompt, Structured Output e auditoria.
- `api/agent-911.js`: função serverless híbrida que escolhe Gemini ou OpenAI sem expor chaves.
- `server/astro911-core.js`: validação dos fatos natais, contrato editorial e auditoria do documento.
- `api/astro-911.js`: função serverless com Gemini principal, fallback entre modelos/providers, cooldown, dedupe e métricas de uso.
- `public/cards/`: 22 imagens WebP otimizadas para o site.
- `tests/`: contratos do baralho, rotas, Ferradura e cálculo astrológico.
- `vercel.json`: fallback de SPA para abrir todas as rotas diretamente na Vercel.

## Método e privacidade do mapa astral

O cálculo usa `circular-natal-horoscope-js` para casas, ângulos e aspectos, e confere as longitudes dos dez planetas com `astronomy-engine`. O local é convertido em coordenadas e fuso pela busca do Open-Meteo; se a rede falhar, as principais capitais brasileiras continuam disponíveis localmente.

O texto digitado na busca de cidade é enviado ao serviço de geocodificação. O cálculo e os dados brutos de nascimento ficam no navegador. Para escrever o Documento Astral, `/api/astro-911` envia ao provedor ativo somente o primeiro nome e um conjunto validado de posições, casas, ângulos, aspectos e equilíbrio elemental — nunca data, horário ou cidade. Mapa e documento ficam somente em `sessionStorage`, expiram em até 12 horas e são removidos ao iniciar outro mapa.

A estrutura planeta–signo–casa–aspecto pertence à astrologia horoscópica desenvolvida no mundo helenístico a partir de tradições mesopotâmicas e egípcias anteriores. O Arcane911 separa essa base histórica da interpretação contemporânea e declara que astrologia é uma linguagem simbólica de autoconhecimento, sem validação científica e sem poder de determinar acontecimentos ou substituir orientação profissional.

Referências: [Hellenistic Astrology — Internet Encyclopedia of Philosophy](https://iep.utm.edu/hellenistic-astrology/) e [tablet zodiacal — British Museum](https://www.britishmuseum.org/collection/object/W_1885-0430-15).

## Direção de produto

O tarot começou como jogo de triunfos na Europa do século XV, passou a ser usado para cartomancia no fim do século XVIII e ganhou uma linguagem fortemente intuitiva com as cenas ilustradas por Pamela Colman Smith no baralho Rider–Waite–Smith, publicado em 1909. O Arcane911 traduz essa evolução em quatro decisões:

1. A imagem vem antes da explicação.
2. O usuário escolhe as cartas; a interface não finge neutralidade algorítmica.
3. A leitura mostra possibilidades e tensões, sem prometer destino inevitável.
4. Cada síntese termina em uma ação observável.
5. A direção provável é tratada como tendência do caminho atual, nunca como destino fixo.

Referência curatorial: [A history of tarot cards — Victoria and Albert Museum](https://www.vam.ac.uk/articles/tarot-cards).

## Agente 911 — publicar na Vercel

A rota `POST /api/agent-911` já está pronta. No projeto existente da Vercel, confirme estas variáveis em **Settings → Environment Variables** e faça um novo deploy:

```env
GEMINI_API_KEY=sua-chave-real
AGENT911_PROVIDER=gemini
GEMINI_MODEL=gemini-3.5-flash
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-terra
VITE_AGENT911_ENABLED=true
VITE_ASTRO911_ENABLED=true
ASTRO911_PROVIDER=gemini
```

`GEMINI_API_KEY` é a única variável obrigatória do Gemini. `AGENT911_PROVIDER=gemini` mantém Gemini como cérebro principal; se `OPENAI_API_KEY` também existir, OpenAI fica disponível apenas como paraquedas. `GEMINI_MODEL` e `GEMINI_FALLBACK_MODEL` são opcionais porque os valores acima já são padrão no código.

Nunca use `VITE_GEMINI_API_KEY`: tudo com prefixo `VITE_` entra no JavaScript público. A V22 não registra perguntas nem dados natais nos logs ou analytics e envia somente o contexto necessário. Os mocks do tarot e do Documento Astral existem apenas no build de desenvolvimento; produção permanece conectada ou mostra indisponibilidade, sem leitura falsa.

Para desligar o agente sem remover código, defina `VITE_AGENT911_ENABLED=false` e faça novo deploy. O passo a passo completo está em `AGENTE911-SETUP.md`.

## Cobrança pronta

O Stripe Checkout hospedado já está ligado às quatro ofertas com preço aprovado e ao Documento Astral opcional. Antes de cobrar qualquer produto, execute `database/arcane911-payment-ledger.sql` em um Supabase exclusivo do Arcane911 e cadastre as quatro variáveis server-side na Vercel:

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

Quando decidir o preço do Documento Astral, informe também o valor em centavos. Exemplo meramente técnico — substitua pelo preço comercial aprovado:

```env
VITE_ASTRO911_PRICE_CENTS=SEU_VALOR_EM_CENTAVOS
```

O servidor só abre produtos pagos depois que ledger e webhook respondem prontos. Em seguida cria a cobrança em BRL, confirma diretamente no Stripe pagamento, valor, moeda, produto, pedido e leitura, registra a autorização e controla créditos de IA no servidor. No Documento Astral, nome, data, hora, cidade e conteúdo do mapa não entram no pagamento nem no ledger; somente o fingerprint técnico. A pergunta privada e as cartas também nunca são enviadas ao checkout. O fluxo de R$ 5,00 exige uma Tiragem Completa paga da mesma leitura. A ordem exata está em `PAGAMENTOS-SETUP.md`.

Eventos disponíveis em `window.dataLayer` e no evento DOM `arcane911:commercial-event`:

- `free_reading_started`
- `free_reading_completed`
- `complete_reading_started`
- `complete_deck_shuffled`
- `complete_reading_opened`
- `offer_opened`
- `begin_checkout`
