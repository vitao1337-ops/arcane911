# Arcane911 V7 — auditoria de entrega

Data: 11 de agosto de 2026

## Resultado

- Build de produção concluído com Vite.
- 32 testes automatizados aprovados; nenhuma falha ou teste ignorado.
- `npm audit --omit=dev`: zero vulnerabilidades encontradas.
- 22 Arcanos canônicos validados.
- 231 relações possíveis entre pares cobertas pelo motor.
- Fluxos visualmente exercitados no Chromium: abertura vazia, leitura de três cartas, Ferradura de sete cartas, resposta inicial, memória consentida e pergunta de aprofundamento.
- Desktop 1440 × 980 e mobile 390 × 844 sem overflow horizontal, imagens quebradas ou erros de console.

## Agente 911

- Endpoint serverless `POST /api/agent-911`.
- Responses API com Structured Output estrito e `store: false`.
- Bíblia server-side própria; nomes, significados e posições enviados pelo navegador não são tratados como fonte de verdade.
- Auditoria oculta recusa carta inventada, carta selecionada não fundamentada, repetição inválida, certeza determinista e menção a Arcano fora da mesa.
- Uma segunda geração corretiva acontece somente quando a primeira resposta não passa na auditoria.
- Limites para saúde, jurídico, finanças, violência, autoagressão, traição, gravidez, morte e intenção secreta de terceiros fazem parte da instrução principal.
- Rate limit server-side de melhor esforço e validação de mesma origem.
- Chave da OpenAI exclusiva do servidor; teste de contrato confirma que ela não volta na resposta.

## Memória

- Desligada por padrão.
- Consentimento explícito por controle dedicado.
- Resumo, temas, pessoas mencionadas e últimas leituras têm limites de tamanho.
- Exclusão integral em dois passos.
- Memória local por dispositivo nesta beta; nenhuma promessa de sincronização entre aparelhos.

## Interface

- Camada visual do agente isolada em `src/agent911.css`.
- Nenhuma alteração estrutural na identidade das cartas, landing, mapa astral ou Ferradura.
- Resposta dividida em fundamento nas cartas, síntese, movimento observável e pergunta final.
- A leitura gratuita oferece uma resposta viva e conduz à Ferradura.
- A Ferradura oferece uma leitura profunda e até três perguntas ligadas à mesma mesa.
- Movimento novo limitado a uma estrela pequena durante o carregamento, com respeito a `prefers-reduced-motion`.

## Limite honesto desta validação

A chave real de produção permanece somente na conta da Vercel e não foi copiada para o ambiente local. A rota foi testada ponta a ponta com resposta de provedor simulada, incluindo payload da Responses API, schema, auditoria, headers, memória e interface. O primeiro consumo real deve ser conferido após o redeploy com a variável `OPENAI_API_KEY` já cadastrada.
