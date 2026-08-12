# Auditoria V13 — Documento Astral 911

Data da rodada: 12 de agosto de 2026.

## Resultado

A V13 transforma `/mapa-astral` em um produto-documento conectado ao Gemini sem delegar o cálculo ao modelo. O motor local continua determinando planetas, signos, graus, casas, Ascendente, Meio do Céu e aspectos. A função server-side valida esse conjunto, entrega ao Gemini apenas fatos permitidos e audita o texto antes de mostrá-lo.

O acesso permanece aberto durante a validação. A interface declara “documento premium em validação” e “acesso aberto durante os testes”, sem preço, checkout, crédito ou compra simulada.

## Escopo entregue

1. `POST /api/astro-911` isolado da rota de tarot, usando a mesma `GEMINI_API_KEY` segura da Vercel.
2. Structured Output com capa, retrato central, cinco capítulos, cinco práticas, cinco perguntas e fechamento.
3. Capítulos obrigatórios: essência, afetos, vocação, tensões e integração.
4. Catálogo de fatos com dez planetas, dois ângulos e aspectos reais; cada capítulo precisa citar de duas a quatro âncoras válidas.
5. Auditoria contra posição inventada, documento raso, falta de ancoragem, estrutura incompleta e linguagem determinista.
6. Privacidade mínima: o Gemini recebe primeiro nome e posições calculadas; não recebe data, horário, cidade ou coordenadas.
7. Cache local de 30 dias por impressão digital do mapa, com deduplicação de pedidos simultâneos.
8. Estado de espera sem texto provisório, erro recuperável e preservação integral do mapa calculado.
9. Impressão A4 e fluxo “Salvar como PDF” sem biblioteca externa.
10. Base histórica declarada e separada de qualquer alegação científica.
11. Switch acessível **Sem rodeios OFF/ON**, explicitamente independente do embaralhamento e das cartas.
12. Zoom mobile bloqueado, prevenção do zoom automático de campos no iPhone e correções de quebra de palavras.

## Fundamento histórico e limite epistemológico

O documento usa uma estrutura reconhecível da astrologia horoscópica ocidental: posições planetárias no zodíaco, Ascendente, doze casas e aspectos. A tradição natal/horoscópica foi desenvolvida em regiões helenizadas a partir de antecedentes mesopotâmicos e egípcios. O sistema de doze partes do zodíaco tem raízes mesopotâmicas documentadas.

Isso não torna a astrologia uma ciência validada. A V13 apresenta a interpretação como tradição simbólica e ferramenta de reflexão. O prompt e a auditoria proíbem destino garantido, diagnóstico, fato oculto e substituição de orientação profissional.

Fontes consultadas:

- [Hellenistic Astrology — Internet Encyclopedia of Philosophy](https://iep.utm.edu/hellenistic-astrology/)
- [Tablet zodiacal — British Museum](https://www.britishmuseum.org/collection/object/W_1885-0430-15)
- [Structured Output — Google AI for Developers](https://ai.google.dev/gemini-api/docs/structured-output)
- [Structured Output no `generateContent` — Google AI for Developers](https://ai.google.dev/gemini-api/docs/generate-content/structured-output)

## Fluxo técnico

1. O navegador recebe nome, data, horário e cidade.
2. O motor local calcula o mapa e faz verificação planetária independente.
3. O cliente remove sobrenome, data, hora, cidade, coordenadas e textos interpretativos locais.
4. `/api/astro-911` valida posições e a coerência planeta–casa.
5. Gemini recebe somente primeiro nome e catálogo de fatos.
6. Structured Output devolve o documento.
7. O servidor normaliza e audita; se necessário, faz uma única tentativa de reparo.
8. O navegador apresenta e guarda o documento daquele mapa.

## Controles de custo e resiliência

- Uma promessa pendente por impressão digital impede duplicação pelo React Strict Mode.
- O documento aprovado fica em cache local por 30 dias.
- Rate limit de oito pedidos por IP em dez minutos.
- `gemini-3.5-flash-lite` é usado apenas se o modelo principal retornar indisponibilidade compatível.
- Uma falha nunca cria um “mapa genérico”; o cálculo completo continua visível e o usuário pode tentar novamente.
- A chamada usa `store: false` e logs não contêm nome nem dados natais.

## Caminho até um produto comercial de maior valor

### Etapa 1 — validação editorial

- Avaliar pelo menos 30 mapas diversos com rubrica de fidelidade factual, integração entre fatores, especificidade, segurança, repetição, latência e custo.
- Fazer revisão humana cega de trechos e registrar somente notas e identificadores técnicos, nunca dados de nascimento em analytics.
- Calibrar o prompt a partir das falhas recorrentes, sem aumentar volume apenas para parecer premium.

### Etapa 2 — valor percebido

- Entrevistar usuários sobre capítulos mais úteis, trechos compartilhados e ações realmente praticadas.
- Medir conclusão, impressão em PDF, retorno ao documento e indicação, sem coletar o conteúdo pessoal.
- Só depois decidir extensão, preço e o que permanece aberto.

### Etapa 3 — venda segura

- Autenticação real, banco server-side separado, consentimento e política de privacidade.
- Checkout, webhook, entitlement idempotente e registro de consumo no servidor.
- Snapshot versionado do cálculo, modelo, prompt e auditoria para recuperar exatamente o documento comprado.
- PDF server-side opcional, com prazo de retenção e exclusão claros.
- Nenhum `localStorage` deve representar compra, conta, crédito ou acesso pago.

### Etapa 4 — evolução astrológica

- Manter o mapa natal como documento principal estável.
- Trânsitos, revolução solar e sinastria devem nascer como produtos separados, com data de referência, método e limites próprios — nunca misturados silenciosamente ao documento natal.

## Validação automatizada

- `npm ci`: aprovado.
- `npm test`: 76/76 aprovados no empacotamento final desta rodada.
- `npm run build`: aprovado.
- Novos contratos cobrem API, contexto mínimo, deduplicação, Structured Output, auditoria factual, zoom e tipografia mobile.
