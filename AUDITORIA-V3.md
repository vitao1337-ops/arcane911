# Auditoria visual e de performance — Arcane911 V3

## Baseline observado no deploy

- 343 elementos no DOM da landing inicial.
- 48 elementos com animação CSS ativa.
- 26 elementos com animação infinita.
- 20 das animações infinitas pertenciam somente aos dois painéis noturnos.
- O painel principal animava simultaneamente sombra externa, borda, campo de estrelas, feixe com blur, véu com blur, duas órbitas, duas constelações e três sigilos.
- A galeria animava o contêiner de vidro de cada uma das 22 cartas enquanto o mesmo elemento aplicava `backdrop-filter` de 22 px.

## Sobreposição de CSS

Foram analisadas 505 regras. Não havia declaração duplicada dentro da mesma regra nem uma segunda versão concorrente dos componentes principais. Os seletores repetidos encontrados pertencem aos breakpoints de 1120, 900, 680 e 410 px e são overrides responsivos intencionais.

## Peso de arquivos

- CSS de produção antes desta lapidação: 57,03 kB; 12,59 kB gzip.
- CSS de produção depois desta lapidação: 53,58 kB; 11,97 kB gzip.
- JavaScript de produção antes: 192,75 kB; 61,37 kB gzip. Depois: 194,45 kB; 61,99 kB gzip, devido ao desenho SVG inline.
- As 22 cartas WebP somam 4,3 MB e usam carregamento preguiçoso fora das três cartas do hero.

O gargalo percebido não era o tamanho do JavaScript. Era o custo de pintura e composição contínua de áreas grandes com blur, sombra e rotação.

## Correções aplicadas

- Removidas as animações de painel, borda, sombra, starfield, feixe, véu, órbitas, constelações e sigilos antigos.
- Criado um campo místico em SVG estático, com fios finos, constelações e sigilos em rosé/champagne.
- Mantidas somente cinco microanimações nos painéis: quatro estrelas pequenas e o centro do medalhão final. Elas alteram apenas opacidade e escala em ciclos de 13 a 15 segundos.
- O glow ambiente de 80 px foi convertido em gradiente radial, sem `filter`.
- A entrada das 22 cartas foi movida do contêiner com vidro para a carta interna.
- O blur do vidro da galeria foi reduzido de 22 para 14 px sem retirar moldura, transparência, brilho e profundidade.
- O glow inferior de cada moldura passou de blur real para gradiente radial.
- Origem, galeria e encerramento usam `content-visibility: auto`, evitando pintura antecipada abaixo da dobra.
- O efeito de vidro que atravessa as três cartas do hero foi preservado integralmente.

## Contrato de regressão

Os testes agora impedem que as animações pesadas removidas sejam reintroduzidas e verificam que o campo místico continue contendo constelações, sigilos e no máximo duas animações infinitas por instância.
