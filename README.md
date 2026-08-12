# Arcane911 — V13 · Documento Astral 911

Primeira versão multipágina do Projeto Arcano, criada a partir do DNA visual do Sorriso Marcado e das 22 cartas originais dos Arcanos Maiores.

## Rotas

- `/`: landing original, com ritual integrado, história e os 22 Arcanos.
- `/tiragem-gratis`: ritual focado de três cartas.
- `/tiragem-completa`: segundo ritual e Ferradura de sete cartas em página própria, preservando pergunta e cartas da abertura.
- `/mapa-astral`: mapa natal completo com cálculo local e Documento Astral Gemini.
- `/leituras/amor`, `/leituras/caminhos`, `/leituras/trabalho` e `/leituras/decisao`: produtos específicos preparados para a próxima fase, ainda sem cobrança.

## O que já funciona

- Escolha de intenção e pergunta livre.
- Embaralhamento Fisher–Yates dos 22 Arcanos com aleatoriedade criptográfica do navegador.
- Proteção contra mesas consecutivas quase idênticas, sem prender cartas a posições recorrentes.
- Seleção manual de três cartas, em ordem.
- Leitura em três posições: A Raiz, O Espelho e O Movimento.
- Aprofundamento liberado em uma Ferradura clássica de sete cartas.
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
- Transição contextual da abertura de três cartas para a Ferradura completa, liberada nesta versão e sem passagem pelo checkout.
- Memória de sessão entre as páginas gratuita e completa, sem colocar a pergunta na URL.
- Página de Mapa Astral com busca de cidade, fuso histórico, Sol, Lua, Ascendente, Meio do Céu, dez planetas, doze casas e aspectos maiores.
- Cálculo tropical em Casas Iguais com verificação independente das longitudes planetárias pelo Astronomy Engine.
- Resultado astrológico serializável, compartilhável e guardado somente no navegador.
- Documento Astral longo e pessoal: essência, afetos, vocação, tensões, integração, cinco práticas e cinco perguntas de reflexão.
- O Gemini recebe apenas primeiro nome e fatos calculados do mapa; data, horário e cidade não saem do navegador nessa chamada.
- Structured Output e auditoria recusam posições inventadas, texto raso, âncoras desconhecidas e determinismo.
- Documento guardado por mapa no aparelho, chamadas simultâneas deduplicadas e botão para imprimir ou salvar como PDF.
- Produto premium sinalizado como em validação e liberado sem cobrança durante os testes; nenhum preço ou checkout foi ativado.
- Carregamento sob demanda: o motor astral não pesa no JavaScript inicial da landing.
- Quatro rotas de leituras específicas com estrutura de cinco cartas e produto comercial já modelado, sem ativar preço ou checkout.
- Os quatro blocos de perguntas específicas também aparecem depois da Ferradura completa.
- Formulário astral renovado com nome completo e superfícies clicáveis de data e horário.
- Microtipografia ampliada somente no desktop, preservando fontes, blocos e direção visual.
- Síntese 911 automática nas leituras de três e sete cartas, pessoal e ancorada na pergunta, sem clique extra nem cadastro.
- Gemini conectado por padrão no mesmo endpoint seguro, usando `gemini-3.5-flash` e Structured Output.
- Segunda rota gratuita automática em `gemini-3.5-flash-lite` quando o modelo principal atinge limite ou fica indisponível.
- No modo conectado, a interface espera a leitura real do Gemini e nunca exibe um texto local provisório para substituí-lo depois.
- Falha conectada preserva cartas e pergunta e oferece nova tentativa sem inventar uma leitura; o motor local existe apenas quando `VITE_AGENT911_MODE=local` é escolhido deliberadamente.
- Dez direções de voz escolhidas pelo contexto, contrato de personalização e auditoria anti-fórmula reduzem aberturas e cadências repetidas.
- Chave simples **Sem rodeios OFF/ON** antes da tiragem. Desligada, a voz é acolhedora; ligada, usa o contrato incisivo. A chave acompanha a sessão e a Consulta 911.
- A interface declara que essa chave muda apenas o tom e nunca interfere no embaralhamento, nas cartas escolhidas ou na tiragem.
- No modo **Sem rodeios**, perguntas binárias recebem uma direção da mesa em **SIM**, **NÃO** ou **INCONCLUSIVA**; perguntas abertas começam por **Na mesa:**.
- A direção binária continua simbólica e condicional. Alegações de traição, doença, crime, gravidez ou intenção secreta são marcadas como **INCONCLUSIVA**, nunca apresentadas como prova.
- A abertura conectada precisa usar as três cartas pelo nome; a Ferradura precisa articular pelo menos cinco cartas e o aprofundamento conecta ao menos duas.
- OpenAI preservada como provedor opcional e reversível, sem ser chamada quando o Gemini está selecionado.
- Falha do modo conectado não consome uma das três perguntas da Consulta 911.
- Uma única síntese por tiragem; o antigo bloco genérico duplicado foi removido.
- Consulta 911 separada da leitura, com cadastro solicitado somente ao entrar e até três aprofundamentos conectados à Ferradura.
- Leituras específicas removidas da abertura gratuita e reposicionadas depois da consulta como alternativa direta de menor escopo.
- Bíblia canônica própria dos 22 Arcanos e das 231 combinações possíveis entre pares; o servidor reconstrói a mesa e não confia em significados enviados pelo navegador.
- Auditoria automática rejeita cartas inventadas, cartas omitidas, certezas deterministas e afirmações sem sustentação na tiragem.
- Memória opcional, privada neste dispositivo, com consentimento explícito e exclusão integral em dois passos.
- Chaves de Gemini ou OpenAI mantidas exclusivamente na função server-side da Vercel; nenhuma credencial é enviada ao navegador.
- Checkout permanece desacoplado no código para monetização futura, com eventos comerciais prontos para GTM/dataLayer.
- Layout responsivo, navegação por teclado e redução de movimento.
- Zoom de interface bloqueado no mobile, campos com 16 px para evitar aproximação automática no iPhone e regras globais contra quebra de palavras.

## Rodar localmente

Requer Node.js 20.19+.

```bash
npm ci
npm run dev
```

O Vite exibirá o endereço local e encaminhará `/api` para a função publicada em `https://arcane911.vercel.app`. Assim, o localhost usa a mesma chave segura da Vercel sem copiá-la para o navegador. Para apontar a um Preview, configure `ARCANE911_DEV_API_TARGET` em `.env.local`.

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
- `src/data/products.js`: estrutura dos produtos específicos futuros.
- `src/lib/reading.js`: embaralhamento, Ferradura determinística, leituras e textos compartilháveis.
- `src/lib/astrology.js`: cálculo natal, dupla verificação, interpretações e busca de cidades.
- `src/pages/AstralMapPage.jsx`: formulário, mandala, leitura calculada e entrada do documento.
- `src/components/Astral911Document.jsx`: estados, capítulos, práticas, cópia e impressão do documento premium.
- `src/lib/astro911.js`: contexto mínimo, cache, deduplicação e cliente seguro do documento.
- `src/config/astro911.js`: ativação e endpoint público sem segredo.
- `src/pages/SpecificReadingPage.jsx`: vitrine das leituras específicas.
- `src/components/NatalWheel.jsx`: mandala SVG responsiva.
- `src/config/sales.js`: produto, preço, benefícios e endereço de checkout.
- `src/config/agent911.js`: ativação, endpoint e oferta futura oculta do Agente 911.
- `src/config/agent911ReadingModes.js`: posturas disponíveis, modo padrão e normalização compartilhada entre navegador e servidor.
- `src/components/Agent911Summary.jsx`: síntese automática, espera ritual, cache conectado e nova tentativa sem texto provisório.
- `src/components/Agent911Consultation.jsx`: cadastro progressivo e conversa de três perguntas.
- `src/lib/agent911Fallback.js`: leitura essencial ancorada para indisponibilidade da API.
- `src/lib/agent911Session.js`: deduplicação de chamadas, cache e cadastro beta local.
- `src/agent911.css`: camada visual isolada do agente, sem alterar o restante do site.
- `src/lib/checkout.js`: parâmetros de compra e eventos comerciais.
- `src/lib/agent911.js`: contexto, guardrails e cliente seguro da rota server-side.
- `src/lib/agent911Memory.js`: módulo de memória consentida preservado para a futura conta server-side; não é acionado na síntese automática.
- `server/tarot-canon.js`: Bíblia 911 dos 22 Arcanos e relações de pares.
- `server/agent911-core.js`: validação, prompt, Structured Output e auditoria.
- `api/agent-911.js`: função serverless híbrida que escolhe Gemini ou OpenAI sem expor chaves.
- `server/astro911-core.js`: validação dos fatos natais, contrato editorial e auditoria do documento.
- `api/astro-911.js`: função Gemini isolada, com rate limit, fallback de modelo e `store: false`.
- `public/cards/`: 22 imagens WebP otimizadas para o site.
- `tests/`: contratos do baralho, rotas, Ferradura e cálculo astrológico.
- `vercel.json`: fallback de SPA para abrir todas as rotas diretamente na Vercel.

## Método e privacidade do mapa astral

O cálculo usa `circular-natal-horoscope-js` para casas, ângulos e aspectos, e confere as longitudes dos dez planetas com `astronomy-engine`. O local é convertido em coordenadas e fuso pela busca do Open-Meteo; se a rede falhar, as principais capitais brasileiras continuam disponíveis localmente.

O texto digitado na busca de cidade é enviado ao serviço de geocodificação. O cálculo e os dados brutos de nascimento ficam no navegador. Para escrever o Documento Astral, `/api/astro-911` envia ao Gemini somente o primeiro nome e um conjunto validado de posições, casas, ângulos, aspectos e equilíbrio elemental — nunca data, horário ou cidade. O resultado fica em cache local por mapa durante 30 dias.

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
VITE_AGENT911_ENABLED=true
VITE_AGENT911_MODE=live
VITE_ASTRO911_ENABLED=true
```

`GEMINI_API_KEY` é a única variável obrigatória do Gemini. `AGENT911_PROVIDER=gemini` apenas trava a escolha; sem ela, o modo `auto` já prefere Gemini quando encontra a chave. `GEMINI_MODEL` e `GEMINI_FALLBACK_MODEL` são opcionais porque os valores acima já são padrão no código.

Nunca use `VITE_GEMINI_API_KEY`: tudo com prefixo `VITE_` entra no JavaScript público. A V13 envia `store: false`, não registra perguntas nem dados natais nos logs ou analytics e envia somente o contexto necessário. No nível gratuito da Gemini Developer API, o Google informa que conteúdo pode ser usado para melhorar produtos; esse ponto precisa entrar na política de privacidade antes de monetização. O motor local do tarot continua disponível somente com `VITE_AGENT911_MODE=local`.

Para desligar o agente sem remover código, defina `VITE_AGENT911_ENABLED=false` e faça novo deploy. O passo a passo completo está em `AGENTE911-SETUP.md`.

## Preparar a venda futura

O CTA da Ferradura está deliberadamente liberado nesta versão. A infraestrutura de checkout foi preservada para a etapa de monetização: copie `.env.example` para `.env.local` e substitua `VITE_CHECKOUT_URL` pelo link HTTPS do produto no provedor escolhido. A integração envia apenas identificadores comerciais — produto, leitura, intenção, cartas e UTMs — sem enviar o texto da pergunta.

```env
VITE_CHECKOUT_URL=https://seu-checkout.com/produto/arcane911
VITE_PRODUCT_ID=arcane911-leitura-profunda
VITE_OFFER_PRICE=
```

Preço permanece vazio até decisão comercial explícita.

Eventos disponíveis em `window.dataLayer` e no evento DOM `arcane911:commercial-event`:

- `free_reading_started`
- `free_reading_completed`
- `complete_reading_started`
- `complete_deck_shuffled`
- `complete_reading_opened`
- `offer_opened`
- `begin_checkout`
