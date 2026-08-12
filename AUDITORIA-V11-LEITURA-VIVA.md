# Auditoria V11 — leitura viva, espera conectada e baralho real

Data: 12 de agosto de 2026.

## Base oficial desta run

- Arquivo recebido: `Arcane911(3).zip`.
- SHA-256: `b7264b84a3b683a9e14475356358a0b7344c8f6a9533097778b6bfebe8ab65ed`.
- A base já continha a correção Gemini publicada no commit `c8789bd6e814f1c503d2e15ffc10c7183dabc2e3`.
- Identidade visual, cartas, molduras, fontes, paleta, rotas e composição foram preservadas.

## Causas confirmadas

### Texto local antes do Gemini

`Agent911Summary` iniciava o estado com `buildAgent911Fallback(...)`, renderizava essa leitura imediatamente e depois a trocava pela resposta conectada. O usuário via duas leituras com vozes diferentes, mesmo quando a API funcionava.

### Repetição aparente das cartas

O baralho manual não usava o Fisher–Yates já existente no projeto. A interface ordenava as cartas pelo hash de `pergunta + intenção + horário` e cortava os primeiros itens. Como mudanças pequenas no final da semente podem preservar rankings correlacionados, mesas sucessivas podiam compartilhar cartas demais.

### Voz ainda pouco pessoal

O prompt pedia uma leitura específica, mas a auditoria aceitava somente um termo concreto da pergunta, duas cartas nomeadas na abertura e quatro na Ferradura. Isso deixava espaço para uma resposta correta, porém transplantável.

## Alterações cirúrgicas

- O modo `live` agora começa vazio e exibe apenas um estado ritual de leitura enquanto aguarda Gemini.
- Nenhuma leitura local é apresentada como provisória ou injetada quando a chamada conectada falha.
- Em falha, pergunta e cartas permanecem, surge uma nova tentativa discreta e nenhuma pergunta da Consulta 911 é consumida.
- O modo local continua disponível somente quando `VITE_AGENT911_MODE=local` é selecionado deliberadamente.
- O cache de síntese foi versionado para impedir reaproveitamento de antigos resultados locais.
- O prompt ganhou uma sequência de reconhecimento, conversa entre cartas e frase de corte, com acolhimento sem consolo automático.
- O modelo recebe um contrato explícito com âncoras concretas da pergunta e quantidade mínima de cartas nomeadas.
- A auditoria exige até duas âncoras da pergunta, três cartas na abertura, cinco na Ferradura e duas no aprofundamento.
- Aberturas genéricas e repetição excessiva de “mostra”, “pede”, “indica” e “revela” acionam reparo automático.
- Perguntas sugeridas que o Gemini inclua numa síntese compacta são descartadas no servidor, pois não aparecem nessa etapa e não devem derrubar uma leitura válida.
- O corte ficou firme sem virar sentença: o prompt e a auditoria agora barram rótulos psicológicos, futuros garantidos e afirmações factuais como "não é amor", "a história acabou", "isso gerará ressentimento", "você já sabe" ou "apego infantil"; a leitura precisa formular hipótese simbólica e apontar evidência observável.
- Formulações interpretativas corrigíveis são suavizadas no servidor antes da auditoria. Isso preserva a força da leitura, evita um segundo consumo do provedor e mantém bloqueios duros para previsões factuais perigosas.
- Problemas apenas estilísticos não derrubam uma resposta segura depois da tentativa de reparo; violações de cartas, estrutura ou certeza continuam bloqueadas.
- O baralho visual agora usa Fisher–Yates com `crypto.getRandomValues` nos navegadores modernos.
- Uma nova embaralhada evita sobreposição excessiva e cartas presas às mesmas posições, respeitando os limites matemáticos do baralho de 22 e do segundo baralho de 19.

## Segurança preservada

- Chaves continuam somente no servidor.
- O servidor reconstrói cartas e posições pela Bíblia 911.
- Continua proibido confirmar traição, gravidez, doença, morte, crime ou intenção secreta.
- Risco imediato interrompe o simbolismo e prioriza ajuda humana.
- Perguntas, nomes e e-mails não entram nos logs nem em analytics.
- `store: false` permanece ativo.

## Validação

- Suíte ampliada com casos de amor, trabalho, decisão, vida interior e caminhos.
- Contratos novos cobrem personalização, cartas nomeadas, abertura genérica, ausência de fallback provisório e distância entre embaralhadas.
- Versão do pacote: `0.12.0`.
