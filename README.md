# Arcane911 — V3 Lapidada

Terceira lapidação navegável do Projeto Arcano, criada em 10/08/2026 a partir do DNA visual do Sorriso Marcado e das 22 cartas originais dos Arcanos Maiores.

## O que já funciona

- Escolha de intenção e pergunta livre.
- Embaralhamento visual dos 22 Arcanos.
- Seleção manual de três cartas, em ordem.
- Leitura em três posições: A Raiz, O Espelho e O Movimento.
- Interpretações autorais com luz, sombra e convite prático.
- Síntese contextual para Caminhos, Amor, Trabalho, Decisão e Eu por dentro.
- Diário local com até 24 leituras neste dispositivo.
- Compartilhamento nativo ou cópia da leitura.
- Galeria completa dos 22 Arcanos, com modal de significado e simbologia.
- Galeria ampliada em composição ritual 7–8–7 no desktop, quatro por fileira no tablet com fechamento centralizado e pares completos no celular.
- Nomes e algarismos calibrados pelo centro real das placas e medalhões das cartas.
- Molduras de vidro renovadas nas cartas principais e na coleção completa.
- Painéis noturnos lapidados, com constelações, traços e sigilos em rosé/champagne; somente estrelas pequenas respiram em baixa frequência.
- Campo místico refeito sem rotação de áreas grandes, blur animado, feixe atravessando o painel ou sombra pulsante.
- Seções abaixo da dobra usam renderização sob demanda e a entrada da galeria não anima mais o vidro com blur.
- Funil gratuito → Leitura Profunda com oferta contextual após a síntese.
- Checkout desacoplado por variável de ambiente e eventos comerciais prontos para GTM/dataLayer.
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
- `src/lib/reading.js`: embaralhamento, leitura e texto compartilhável.
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

Referência curatorial: [A history of tarot cards — Victoria and Albert Museum](https://www.vam.ac.uk/articles/tarot-cards).

## Próxima camada recomendada

Autenticação, diário sincronizado, leitura diária, confirmação server-side de compra e interpretações assistidas por IA podem entrar na Fase 2 sem alterar o ritual central desta V1.

## Ativar a venda

Copie `.env.example` para `.env.local` e substitua `VITE_CHECKOUT_URL` pelo link HTTPS do produto no provedor escolhido. O clique envia apenas identificadores comerciais — produto, leitura, intenção, cartas e UTMs — sem enviar o texto da pergunta.

```env
VITE_CHECKOUT_URL=https://seu-checkout.com/produto/arcane911
VITE_PRODUCT_ID=arcane911-leitura-profunda
VITE_OFFER_PRICE=R$ 19,90
```

Eventos disponíveis em `window.dataLayer` e no evento DOM `arcane911:commercial-event`:

- `free_reading_started`
- `free_reading_completed`
- `offer_opened`
- `begin_checkout`
