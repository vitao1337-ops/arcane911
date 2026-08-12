# Arcane911 V13 — Gemini no tarot e no Documento Astral

A V13 usa Gemini em dois endpoints server-side: `/api/agent-911` para tarot e `/api/astro-911` para o Documento Astral. Nenhuma chave entra no React. Os dois tentam `gemini-3.5-flash` e passam para `gemini-3.5-flash-lite` quando o principal atinge limite ou fica indisponível. O tarot continua sem texto provisório e a chave **Sem rodeios OFF/ON** acompanha a Ferradura e a Consulta 911.

## 1. Variáveis na Vercel

Em **Project Settings → Environment Variables**, configure:

```env
GEMINI_API_KEY=sua-chave-real
AGENT911_PROVIDER=gemini
GEMINI_MODEL=gemini-3.5-flash
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite
VITE_AGENT911_ENABLED=true
VITE_AGENT911_MODE=live
VITE_ASTRO911_ENABLED=true
```

- `GEMINI_API_KEY` é obrigatória e deve ser marcada como sensível.
- A rota também reconhece `GOOGLE_API_KEY` e `GOOGLE_GENERATIVE_AI_API_KEY`, mas use apenas um nome para evitar confusão.
- `AGENT911_PROVIDER=gemini` é opcional. Sem essa variável, `auto` prefere Gemini quando a chave está presente e só usa OpenAI quando não existe chave Gemini.
- `GEMINI_MODEL` e `GEMINI_FALLBACK_MODEL` são opcionais; os valores acima já são os padrões da V13 e servem às duas rotas.
- `ASTRO911_MODEL` e `ASTRO911_FALLBACK_MODEL` podem sobrescrever somente o documento, mas devem permanecer vazias enquanto não houver motivo medido para separar modelos.
- `VITE_AGENT911_MODE=live` garante que o navegador consulte a função. Se existir um valor antigo `local` na Vercel, troque-o ou remova-o antes do redeploy.
- Nunca crie `VITE_GEMINI_API_KEY`, `VITE_GOOGLE_API_KEY` ou outra chave secreta com prefixo `VITE_`.

Marque pelo menos **Production**. Marque também **Preview** se for testar o link de Preview. Mudança de variável só entra após um novo deploy.

## 2. Publicar

Suba a V13 no repositório já conectado ao projeto atual. Não crie outro projeto na Vercel. O `vercel.json` preserva as duas funções e as rotas React.

Depois do deploy, confirme nesta ordem:

1. Abra `/tiragem-gratis`, escreva uma pergunta concreta e revele três cartas.
2. Verifique que a leitura curta aparece automaticamente e responde ao conflito da pergunta.
3. Ligue **Sem rodeios**; numa pergunta binária, confirme o selo **SIM**, **NÃO** ou **INCONCLUSIVA**. Desligue e confirme a voz acolhedora.
4. Continue para a Ferradura, escolha quatro cartas novas e valide a síntese única de sete cartas.
5. Abra **Consulta 911**, conclua o cadastro beta e envie três aprofundamentos.
6. Confirme que a quarta pergunta não é liberada.
7. Abra `/mapa-astral`, calcule um mapa e confirme que o Documento Astral conclui cinco capítulos, práticas e perguntas.
8. Use **Salvar como PDF** e confirme a versão A4 sem navegação, formulário ou botões.
9. Recarregue a página e confirme que o documento nasce do cache sem nova chamada.
10. Para testar resiliência, altere temporariamente `GEMINI_API_KEY` em um Preview e confirme que tarot e mapa oferecem nova tentativa sem texto genérico; não faça esse teste destrutivo em Production.

A resposta JSON da API inclui `meta.provider`, `meta.model` e `meta.usedFallbackModel`. A interface também grava `data-agent911-provider` nos blocos de leitura. Isso permite distinguir Gemini e modelo secundário sem enviar pergunta, nome ou e-mail para analytics.

## 3. Localhost usando a chave da Vercel

Instale e rode:

```bash
npm ci
npm run dev
```

O Vite encaminha todo `/api` para `https://arcane911.vercel.app`. Portanto, depois que a V13 estiver publicada, o localhost usa as duas funções e a chave da Vercel. A chave não precisa existir no computador e nunca chega ao navegador.

Para usar um deploy de Preview:

```env
ARCANE911_DEV_API_TARGET=https://seu-preview.vercel.app
```

Reinicie `npm run dev` depois de alterar `.env.local`.

## 4. Alternar ou desligar sem editar código

Somente motor local, sem enviar pergunta ao provedor:

```env
VITE_AGENT911_MODE=local
```

Voltar ao Gemini conectado:

```env
VITE_AGENT911_MODE=live
AGENT911_PROVIDER=gemini
```

Usar OpenAI deliberadamente:

```env
AGENT911_PROVIDER=openai
OPENAI_API_KEY=sua-chave
OPENAI_MODEL=gpt-5.6-terra
```

Desligar todo o bloco 911:

```env
VITE_AGENT911_ENABLED=false
```

Desligar apenas o Documento Astral conectado:

```env
VITE_ASTRO911_ENABLED=false
```

Toda alteração `VITE_*` exige novo build/deploy.

## 5. Privacidade e limites reais

- No modo `live`, pergunta, cartas, posições e histórico curto da consulta são enviados ao provedor pelo servidor. Nome e e-mail do cadastro beta não entram nessa requisição.
- No mapa, somente o primeiro nome e fatos calculados são enviados ao Gemini. Data, horário, cidade e coordenadas não entram em `/api/astro-911`.
- O documento é cacheado localmente por mapa para reduzir custo e evitar nova chamada em reloads; pedidos simultâneos são deduplicados.
- O rate limit do documento é menor que o do tarot: oito gerações por IP a cada dez minutos.
- A síntese automática usa `memoryConsent: false`; memória pessoal não é enviada.
- A função envia `store: false` e nunca registra o texto da pergunta nos logs de erro.
- Nenhuma pergunta, nome ou e-mail é enviado aos eventos comerciais.
- O servidor reconstrói a Bíblia 911 e recusa cartas ou posições inventadas pelo navegador.
- Segundo a página oficial de preços do Gemini, conteúdo do nível gratuito pode ser usado pelo Google para melhorar produtos. Antes de monetizar, isso deve aparecer na política de privacidade ou o projeto deve migrar para uma modalidade com condições adequadas.
- Cadastro, respostas e limite ainda são beta de sessão/local. Isso não representa conta, compra, crédito nem autorização server-side.

Referências oficiais consultadas em 12 de agosto de 2026:

- [Modelos Gemini](https://ai.google.dev/gemini-api/docs/models)
- [Structured Output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Referência `generateContent`](https://ai.google.dev/api/generate-content)
- [Preços e condições do nível gratuito](https://ai.google.dev/gemini-api/docs/pricing)
- [Hellenistic Astrology — Internet Encyclopedia of Philosophy](https://iep.utm.edu/hellenistic-astrology/)
- [Zodíaco mesopotâmico — British Museum](https://www.britishmuseum.org/collection/object/W_1885-0430-15)
