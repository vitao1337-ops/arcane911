# Auditoria V12 — chave da mesa e eixo das cartas

Data: 12 de agosto de 2026.

## Base oficial desta run

- Arquivo recebido: `Arcane911(4).zip`.
- SHA-256: `ca3e8f3b866a465d3d34d1e8cd55b1824a6b5cd7ca2a435d0ef5124cad315756`.
- Versão inicial do pacote: `0.12.0`.
- Identidade visual, cartas, molduras, fontes, paleta, rotas e composição foram preservadas.

## Causa do desalinhamento

As artes WebP já possuíam as placas vazias alinhadas. Nome e algarismo são camadas HTML. Essas camadas usavam margens laterais simétricas, mas também `text-indent`, e cada contexto aplicava um tamanho de fonte diferente. Em cartas pequenas — principalmente na Ferradura mobile — o recuo tipográfico se tornava visível e nomes como **A Morte** pareciam sair do eixo.

## Correção visual

- Nome e algarismo agora usam `left: 50%` e `translate(-50%, -50%)`.
- O recuo artificial foi removido.
- Cada carta virou um contêiner de medida; o nome escala pelo comprimento e pelo tamanho real da carta.
- Carta, badge numérico e legenda da Ferradura compartilham o mesmo eixo.
- A correção vale para hero, abertura, Ferradura, cartas preservadas, leitura completa, galeria e modal.

## Chave de postura

- **Acolhedora:** mantém a voz íntima, firme e cuidadosa da V11.
- **Direta:** responde o centro da pergunta cedo e termina com conselho curto e verificável.
- **Sem rodeios:** usa **SIM**, **NÃO** ou **INCONCLUSIVA** em pergunta binária; em pergunta aberta, começa por **Na mesa:**.
- A escolha é salva na sessão, participa da chave de cache e acompanha síntese de três cartas, Ferradura e três aprofundamentos.
- O servidor valida e normaliza o modo; não confia em texto arbitrário enviado pelo navegador.

## Limite honesto do SIM/NÃO

O veredito representa direção simbólica do caminho atual, não previsão garantida. Perguntas que pedem prova de traição, mentira, gravidez, doença, crime, feitiço ou intenção secreta são classificadas como fato inacessível e recebem **INCONCLUSIVA**. O restante da leitura aponta cartas, condições e evidências observáveis.

## Pergunta e embaralhamento

A interface explica que fatos e contexto ajudam o 911 a interpretar a situação, mas não interferem no embaralhamento nem escolhem cartas. O Fisher–Yates com `crypto.getRandomValues` e a proteção contra mesas consecutivas quase idênticas foram preservados.

## Resiliência e privacidade

- O modo conectado continua sem fallback local provisório.
- Falha remota mantém a mesa e oferece nova tentativa sem consumir pergunta.
- Nenhuma chave entra no navegador.
- Texto da pergunta, nome e e-mail não entram em analytics ou logs de erro.
- `store: false`, cânone server-side, auditoria de cartas e bloqueios de certeza factual permanecem ativos.

## Validação

- 63 testes automatizados aprovados nesta etapa.
- Build Vite de produção aprovado.
- Testes novos cobrem as três posturas, classificação binária, fatos protegidos, normalização de saída, cache por modo, transmissão cliente-servidor e regras estruturais de centralização.
- Versão do pacote: `0.13.0`.
