# Arcane911 — V9 · Motor local contextual

Primeira versão multipágina do Projeto Arcano, criada a partir do DNA visual do Sorriso Marcado e das 22 cartas originais dos Arcanos Maiores.

## Rotas

- `/`: landing original, com ritual integrado, história e os 22 Arcanos.
- `/tiragem-gratis`: ritual focado de três cartas.
- `/tiragem-completa`: segundo ritual e Ferradura de sete cartas em página própria, preservando pergunta e cartas da abertura.
- `/mapa-astral`: mapa natal completo com cálculo local.
- `/leituras/amor`, `/leituras/caminhos`, `/leituras/trabalho` e `/leituras/decisao`: produtos específicos preparados para a próxima fase, ainda sem cobrança.

## O que já funciona

- Escolha de intenção e pergunta livre.
- Embaralhamento visual dos 22 Arcanos.
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
- Molduras de vidro renovadas nas cartas principais e na coleção completa.
- Painéis noturnos lapidados, com constelações, traços e sigilos em rosé/champagne; somente estrelas pequenas respiram em baixa frequência.
- Campo místico refeito sem rotação de áreas grandes, blur animado, feixe atravessando o painel ou sombra pulsante.
- Seções abaixo da dobra usam renderização sob demanda e a entrada da galeria não anima mais o vidro com blur.
- Transição contextual da abertura de três cartas para a Ferradura completa, liberada nesta versão e sem passagem pelo checkout.
- Memória de sessão entre as páginas gratuita e completa, sem colocar a pergunta na URL.
- Página de Mapa Astral com busca de cidade, fuso histórico, Sol, Lua, Ascendente, Meio do Céu, dez planetas, doze casas e aspectos maiores.
- Cálculo tropical em Casas Iguais com verificação independente das longitudes planetárias pelo Astronomy Engine.
- Resultado astrológico serializável, compartilhável e guardado somente no navegador.
- Carregamento sob demanda: o motor astral não pesa no JavaScript inicial da landing.
- Quatro rotas de leituras específicas com estrutura de cinco cartas e produto comercial já modelado, sem ativar preço ou checkout.
- Os quatro blocos de perguntas específicas também aparecem depois da Ferradura completa.
- Formulário astral renovado com nome completo e superfícies clicáveis de data e horário.
- Microtipografia ampliada somente no desktop, preservando fontes, blocos e direção visual.
- Síntese 911 automática nas leituras de três e sete cartas, pessoal e ancorada na pergunta, sem clique extra nem cadastro.
- Motor local contextual instantâneo, sem custo por leitura: interpreta o conflito concreto da pergunta, as posições, as cartas e suas relações.
- Modo conectado opcional: quando houver crédito, a OpenAI pode substituir a leitura local sem quebrar o funil.
- Falha do modo conectado mantém a leitura essencial e não consome uma das três perguntas da Consulta 911.
- Uma única síntese por tiragem; o antigo bloco genérico duplicado foi removido.
- Consulta 911 separada da leitura, com cadastro solicitado somente ao entrar e até três aprofundamentos conectados à Ferradura.
- Leituras específicas removidas da abertura gratuita e reposicionadas depois da consulta como alternativa direta de menor escopo.
- Bíblia canônica própria dos 22 Arcanos e das 231 combinações possíveis entre pares; o servidor reconstrói a mesa e não confia em significados enviados pelo navegador.
- Auditoria automática rejeita cartas inventadas, cartas omitidas, certezas deterministas e afirmações sem sustentação na tiragem.
- Memória opcional, privada neste dispositivo, com consentimento explícito e exclusão integral em dois passos.
- Chave da OpenAI mantida exclusivamente na função server-side da Vercel; nenhuma credencial é enviada ao navegador.
- Checkout permanece desacoplado no código para monetização futura, com eventos comerciais prontos para GTM/dataLayer.
- Layout responsivo, navegação por teclado e redução de movimento.

## Rodar localmente

Requer Node.js 20.19+.

```bash
npm install
npm run dev
```

O Vite exibirá o endereço local. Para validar a versão de produção:

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
- `src/pages/AstralMapPage.jsx`: formulário, mandala e leitura do mapa.
- `src/pages/SpecificReadingPage.jsx`: vitrine das leituras específicas.
- `src/components/NatalWheel.jsx`: mandala SVG responsiva.
- `src/config/sales.js`: produto, preço, benefícios e endereço de checkout.
- `src/config/agent911.js`: ativação, endpoint e oferta futura oculta do Agente 911.
- `src/components/Agent911Summary.jsx`: síntese automática, cache de sessão e fallback resiliente.
- `src/components/Agent911Consultation.jsx`: cadastro progressivo e conversa de três perguntas.
- `src/lib/agent911Fallback.js`: leitura essencial ancorada para indisponibilidade da API.
- `src/lib/agent911Session.js`: deduplicação de chamadas, cache e cadastro beta local.
- `src/agent911.css`: camada visual isolada do agente, sem alterar o restante do site.
- `src/lib/checkout.js`: parâmetros de compra e eventos comerciais.
- `src/lib/agent911.js`: contexto, guardrails e cliente seguro da rota server-side.
- `src/lib/agent911Memory.js`: módulo de memória consentida preservado para a futura conta server-side; não é acionado na síntese automática.
- `server/tarot-canon.js`: Bíblia 911 dos 22 Arcanos e relações de pares.
- `server/agent911-core.js`: validação, prompt, Structured Output e auditoria.
- `api/agent-911.js`: função serverless que conversa com a OpenAI sem expor a chave.
- `public/cards/`: 22 imagens WebP otimizadas para o site.
- `tests/`: contratos do baralho, rotas, Ferradura e cálculo astrológico.
- `vercel.json`: fallback de SPA para abrir todas as rotas diretamente na Vercel.

## Método e privacidade do mapa astral

O cálculo usa `circular-natal-horoscope-js` para casas, ângulos e aspectos, e confere as longitudes dos dez planetas com `astronomy-engine`. O local é convertido em coordenadas e fuso pela busca do Open-Meteo; se a rede falhar, as principais capitais brasileiras continuam disponíveis localmente.

Somente o texto digitado na busca de cidade é enviado ao serviço de geocodificação. Nome, data, horário, mapa e síntese permanecem no navegador. Astrologia é apresentada como linguagem simbólica de autoconhecimento, não como determinação ou orientação profissional.

## Direção de produto

O tarot começou como jogo de triunfos na Europa do século XV, passou a ser usado para cartomancia no fim do século XVIII e ganhou uma linguagem fortemente intuitiva com as cenas ilustradas por Pamela Colman Smith no baralho Rider–Waite–Smith, publicado em 1909. O Arcane911 traduz essa evolução em quatro decisões:

1. A imagem vem antes da explicação.
2. O usuário escolhe as cartas; a interface não finge neutralidade algorítmica.
3. A leitura mostra possibilidades e tensões, sem prometer destino inevitável.
4. Cada síntese termina em uma ação observável.
5. A direção provável é tratada como tendência do caminho atual, nunca como destino fixo.

Referência curatorial: [A history of tarot cards — Victoria and Albert Museum](https://www.vam.ac.uk/articles/tarot-cards).

## Agente 911 — publicar na Vercel

A rota `POST /api/agent-911` já está pronta. No projeto da Vercel, abra **Settings → Environment Variables**, adicione `OPENAI_API_KEY` com a sua chave e aplique em Production, Preview e Development conforme a necessidade. Em seguida, faça um novo deploy. Opcionalmente, configure `OPENAI_MODEL=gpt-5.6-terra`; esse já é o modelo padrão do código.

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.6-terra
VITE_AGENT911_ENABLED=true
VITE_AGENT911_MODE=local
```

Nunca use o prefixo `VITE_` na chave secreta. Variáveis `VITE_*` entram no JavaScript público. No modo `local`, pergunta e cartas não são enviadas à OpenAI. Para reativar o modo conectado, defina `VITE_AGENT911_MODE=live` e faça novo deploy; as respostas continuam usando `store: false`. A memória é uma beta local: fica no navegador atual, não acompanha outro aparelho e pode ser apagada na própria interface.

Para desligar o agente sem remover código, defina `VITE_AGENT911_ENABLED=false` e faça novo deploy. O passo a passo completo está em `AGENTE911-SETUP.md`.

## Preparar a venda futura

O CTA da Ferradura está deliberadamente liberado nesta versão. A infraestrutura de checkout foi preservada para a etapa de monetização: copie `.env.example` para `.env.local` e substitua `VITE_CHECKOUT_URL` pelo link HTTPS do produto no provedor escolhido. A integração envia apenas identificadores comerciais — produto, leitura, intenção, cartas e UTMs — sem enviar o texto da pergunta.

```env
VITE_CHECKOUT_URL=https://seu-checkout.com/produto/arcane911
VITE_PRODUCT_ID=arcane911-leitura-profunda
VITE_OFFER_PRICE=R$ 19,90
```

Eventos disponíveis em `window.dataLayer` e no evento DOM `arcane911:commercial-event`:

- `free_reading_started`
- `free_reading_completed`
- `complete_reading_started`
- `complete_deck_shuffled`
- `complete_reading_opened`
- `offer_opened`
- `begin_checkout`
