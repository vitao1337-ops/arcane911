# Arcane911 — V4 · Ferradura Completa

Quarta versão navegável do Projeto Arcano, criada em 10/08/2026 a partir do DNA visual do Sorriso Marcado e das 22 cartas originais dos Arcanos Maiores.

## O que já funciona

- Escolha de intenção e pergunta livre.
- Embaralhamento visual dos 22 Arcanos.
- Seleção manual de três cartas, em ordem.
- Leitura em três posições: A Raiz, O Espelho e O Movimento.
- Aprofundamento liberado em uma Ferradura clássica de sete cartas.
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

- `src/App.jsx`: experiência completa e estados do ritual.
- `src/styles.css`: direção visual, animações e responsividade.
- `src/data/tarot.js`: conteúdo dos 22 Arcanos.
- `src/lib/reading.js`: embaralhamento, Ferradura determinística, leituras e textos compartilháveis.
- `src/config/sales.js`: produto, preço, benefícios e endereço de checkout.
- `src/lib/checkout.js`: parâmetros de compra e eventos comerciais.
- `public/cards/`: 22 imagens WebP otimizadas para o site.
- `tests/tarot.test.js`: contratos do baralho e da leitura.

## Direção de produto

O tarot começou como jogo de triunfos na Europa do século XV, passou a ser usado para cartomancia no fim do século XVIII e ganhou uma linguagem fortemente intuitiva com as cenas ilustradas por Pamela Colman Smith no baralho Rider–Waite–Smith, publicado em 1909. O Arcane911 traduz essa evolução em quatro decisões:

1. A imagem vem antes da explicação.
2. O usuário escolhe as cartas; a interface não finge neutralidade algorítmica.
3. A leitura mostra possibilidades e tensões, sem prometer destino inevitável.
4. Cada síntese termina em uma ação observável.
5. A direção provável é tratada como tendência do caminho atual, nunca como destino fixo.

Referência curatorial: [A history of tarot cards — Victoria and Albert Museum](https://www.vam.ac.uk/articles/tarot-cards).

## Próxima camada recomendada

Autenticação, diário sincronizado, leitura diária, confirmação server-side de compra e a agente de interpretação podem entrar na Fase 2 sem alterar o ritual central. A versão atual funciona inteira sem IA.

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
- `complete_reading_opened`
- `offer_opened`
- `begin_checkout`
