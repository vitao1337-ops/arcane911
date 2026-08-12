# Auditoria V9 — Motor local contextual

Data: 12/08/2026  
Base recebida: `Arcane911-V8-FUNIL.zip`  
SHA-256 da base recebida: `f5801f2c174c613e68ecbd59ca9302e07ba1da7058fe8f5754bf60d676315607`

## Diagnóstico reproduzido em produção

- A interface marcou a leitura como `data-agent911-source="essential"`.
- `POST /api/agent-911` respondeu `502 {"error":"agent_unavailable"}`.
- Com as mesmas cartas, cinco perguntas diferentes produziram o mesmo título, síntese e ação no fallback anterior.
- A Consulta 911 também usava uma fórmula fixa e consumia uma pergunta mesmo quando o provedor falhava.
- Os testes anteriores validavam contratos e um provedor simulado, mas não mediam monotonia nem personalização.

## Arquitetura aplicada

### Modo local gratuito

- `VITE_AGENT911_MODE=local` é o padrão.
- Nenhuma chamada à OpenAI é iniciada nesse modo.
- A abertura, a Ferradura e as três perguntas da Consulta 911 continuam funcionando.
- A pergunta é classificada pelo conflito concreto: retorno, término, confiança, carreira, proposta, amizade, família, criação, decisão ou vida interior.
- O motor combina pergunta, intenção, carta, posição, luz, sombra, movimento e relações do cânone.
- Títulos, sínteses e ações variam de acordo com a pergunta e a mesa.

### Modo conectado futuro

- `VITE_AGENT911_MODE=live` reativa a rota server-side quando houver crédito.
- A Ferradura usa raciocínio médio no modelo.
- Somente seis relações decisivas são enviadas na tiragem completa, em vez de vinte e uma relações indiscriminadas.
- A auditoria exige que a interpretação reflita ao menos um elemento concreto da pergunta fora da citação inicial.
- Erros de crédito, modelo, autenticação e requisição são classificados separadamente sem registrar a pergunta pessoal.
- Se o provedor falhar numa pergunta da Consulta, a leitura essencial aparece, mas a tentativa não consome o limite.

### Interface e observabilidade

- O texto relacional de `sections` agora é exibido dentro da mesma síntese; nenhuma parte pessoal fica escondida.
- A origem da resposta permanece disponível em `data-agent911-source`: `local`, `live` ou `fallback`.
- Eventos registram somente origem, etapa, quantidade de cartas e motivo técnico; nunca pergunta, nome ou e-mail.
- Identidade visual, cartas, fontes, paleta, molduras, rotas e composição foram preservadas.

## Validação

- `npm test`: 44/44 contratos aprovados.
- Cinco perguntas de áreas diferentes, com as mesmas cartas: 5 títulos, 5 sínteses e 5 ações distintas.
- Seis perguntas somente de amor: sínteses distintas e ancoradas no texto atual.
- Abertura, Ferradura, aprofundamentos, segurança, limite não consumido, modo sem custo, cânone e API cobertos.
- `npm run build`: produção compilada com sucesso.
- Bundle inicial: `313,81 kB`, gzip `100,68 kB`.
- Motor astral preservado como chunk tardio.

## Publicação sem custo de API

1. Publique esta versão no mesmo repositório conectado à Vercel.
2. Mantenha `VITE_AGENT911_MODE=local` ou remova a variável, pois `local` é o padrão.
3. Faça novo deploy para substituir o bundle anterior.
4. Quando houver crédito, defina `VITE_AGENT911_MODE=live`, confira `OPENAI_API_KEY` e faça outro deploy.

Não é necessário remover a chave atual para usar o modo local: o navegador simplesmente não chama a rota conectada.
