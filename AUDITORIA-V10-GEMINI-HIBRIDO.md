# Auditoria V10 — Gemini híbrido e voz anti-monotonia

Data da auditoria: 12 de agosto de 2026.

## Base preservada

- Fonte desta continuação: `Arcane911-V9-MOTOR-LOCAL.zip`.
- SHA-256 da fonte: `3d35c9ef155602f15920ab01ee3e17b3753e464bc635b6a4f3ed83c923163fb7`.
- A V10 foi extraída dessa entrega completa; não houve reinício de projeto, troca de stack, identidade visual, baralho, fontes, molduras ou composição.
- Nenhum repositório Git ou projeto novo foi criado.

## Diagnóstico da monotonia

A resposta conectada tinha boa ancoragem e auditoria, mas ainda induzia repetição por três causas:

1. Um único prompt definia a mesma porta de entrada para todas as perguntas.
2. O formato fixo de síntese favorecia verbos recorrentes como “mostra”, “pede” e “indica”.
3. O contrato verificava cartas e segurança, mas não entregava ao modelo uma direção de ritmo específica para cada mesa.

A correção preserva o Structured Output e adiciona seis direções internas de voz: contraste, imagem, movimento, limite, evidência e paradoxo. A escolha é determinística a partir da tarefa, pergunta e cartas; não depende de dados pessoais e não aparece na interface. O prompt agora proíbe aberturas reutilizáveis, exige relações pelo nome das cartas e pede uma frase de corte que não possa ser transplantada para qualquer leitura.

## Arquitetura implementada

O endpoint público continua sendo `POST /api/agent-911`.

Ordem padrão no servidor:

1. Gemini `gemini-3.5-flash`.
2. Gemini `gemini-3.5-flash-lite` somente quando o principal retorna indisponibilidade, limite ou modelo ausente.
3. Motor local contextual no navegador quando a rota conectada falha.

OpenAI permanece disponível apenas como alternativa configurável. Em `auto`, uma chave Gemini tem precedência sobre uma chave OpenAI. `AGENT911_PROVIDER=gemini` fixa explicitamente essa escolha.

## Segurança e contrato

- Chaves aceitas somente no servidor: `GEMINI_API_KEY`, `GOOGLE_API_KEY` ou `GOOGLE_GENERATIVE_AI_API_KEY`.
- Nenhuma variante `VITE_*` de chave é lida.
- A chamada Gemini usa header `x-goog-api-key`, `store: false` e `responseMimeType: application/json`.
- O JSON Schema do 911 é adaptado ao subconjunto aceito pelo Gemini sem afrouxar a auditoria local.
- O servidor continua reconstruindo cartas, posições e relações pela Bíblia 911.
- Respostas ainda passam pela auditoria e por uma tentativa de reparo antes de chegar ao usuário.
- Logs de erro contêm provedor, status e código técnico, nunca pergunta, nome ou e-mail.
- O frontend recebe somente `meta.provider`, `meta.model` e `meta.usedFallbackModel` para observabilidade sem conteúdo pessoal.
- Falha da API na Consulta 911 não consome uma pergunta.

## Localhost e produção

- A V10 nasce com `VITE_AGENT911_MODE=live` quando não existe override.
- `npm run dev` mantém o proxy de `/api` para a função publicada na Vercel.
- `ARCANE911_DEV_API_TARGET` permite apontar o localhost a um Preview.
- O modo totalmente local continua disponível com `VITE_AGENT911_MODE=local`.
- A Vercel precisa de novo deploy depois da entrada desta V10; colocar somente a chave não altera o código de um deploy antigo.

Auditoria pública realizada nesta execução:

- `https://arcane911.vercel.app/` respondeu `200` e ainda carregou o bundle V9 `index-B9w3JD41.js`.
- Um POST neutro e válido em `/api/agent-911` respondeu `503 provider_quota`, confirmando que a função publicada ainda tenta OpenAI.
- O bundle novo validado localmente é `index-XUNEqYDf.js`; ele só passa a existir online depois do redeploy da V10.

## Privacidade do nível gratuito

O nível gratuito resolve o bloqueio de crédito, mas tem uma condição real: a documentação de preços do Google informa que conteúdo do Free Tier pode ser usado para melhorar produtos. O produto deve declarar isso antes de monetização ou migrar para uma modalidade contratual adequada. Nome e e-mail do cadastro beta não são enviados ao Gemini; pergunta, cartas e histórico curto são enviados no modo conectado porque são o material da leitura.

## Validação automatizada

- `npm ci`: aprovado.
- `npm test`: 48 de 48 testes aprovados.
- Contratos novos cobrem Gemini, segredo server-side, schema compatível, parser, metadados e troca automática para Flash-Lite.
- `npm run build`: aprovado; bundle inicial `314.63 kB` (`100.91 kB` gzip) e motor astral preservado em chunk tardio de `877.49 kB`.
- Inspeção final do ZIP: aprovada sem `node_modules`, `.git`, `.vercel`, arquivos locais de ambiente ou padrões de chave real; o conteúdo extraído repetiu `npm ci`, 48/48 testes e build com sucesso.

## Limite desta execução

Os testes de provedor usam respostas Gemini simuladas e verificam a requisição completa sem chave real no workspace. O deploy e a chamada real com a chave da conta não foram executados porque não há sessão autenticada da Vercel nesta execução. A publicação deve ocorrer no projeto existente, nunca em um projeto novo.

## Fontes oficiais consultadas

- [Modelos Gemini](https://ai.google.dev/gemini-api/docs/models)
- [Gemini 3.6 Flash e recursos suportados](https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash)
- [Structured Output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Referência `generateContent`](https://ai.google.dev/api/generate-content)
- [Preços e Free Tier](https://ai.google.dev/gemini-api/docs/pricing)
