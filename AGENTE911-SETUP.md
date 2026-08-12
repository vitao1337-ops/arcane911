# Agente 911 — Gemini na Vercel e no localhost

A V10 usa Gemini no mesmo endpoint server-side `/api/agent-911`. Nenhuma chave entra no React. O fluxo conectado nasce ativo, tenta `gemini-3.5-flash`, passa para `gemini-3.5-flash-lite` quando o primeiro modelo atinge limite ou fica indisponível e termina no motor local se a API inteira falhar.

## 1. Variáveis na Vercel

Em **Project Settings → Environment Variables**, configure:

```env
GEMINI_API_KEY=sua-chave-real
AGENT911_PROVIDER=gemini
GEMINI_MODEL=gemini-3.5-flash
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite
VITE_AGENT911_ENABLED=true
VITE_AGENT911_MODE=live
```

- `GEMINI_API_KEY` é obrigatória e deve ser marcada como sensível.
- A rota também reconhece `GOOGLE_API_KEY` e `GOOGLE_GENERATIVE_AI_API_KEY`, mas use apenas um nome para evitar confusão.
- `AGENT911_PROVIDER=gemini` é opcional. Sem essa variável, `auto` prefere Gemini quando a chave está presente e só usa OpenAI quando não existe chave Gemini.
- `GEMINI_MODEL` e `GEMINI_FALLBACK_MODEL` são opcionais; os valores acima já são os padrões da V10.
- `VITE_AGENT911_MODE=live` garante que o navegador consulte a função. Se existir um valor antigo `local` na Vercel, troque-o ou remova-o antes do redeploy.
- Nunca crie `VITE_GEMINI_API_KEY`, `VITE_GOOGLE_API_KEY` ou outra chave secreta com prefixo `VITE_`.

Marque pelo menos **Production**. Marque também **Preview** se for testar o link de Preview. Mudança de variável só entra após um novo deploy.

## 2. Publicar

Suba a V10 no repositório já conectado ao projeto atual. Não crie outro projeto na Vercel. O `vercel.json` preserva a função e as rotas React.

Depois do deploy, confirme nesta ordem:

1. Abra `/tiragem-gratis`, escreva uma pergunta concreta e revele três cartas.
2. Verifique que a leitura curta aparece automaticamente e responde ao conflito da pergunta.
3. Continue para a Ferradura, escolha quatro cartas novas e valide a síntese única de sete cartas.
4. Abra **Consulta 911**, conclua o cadastro beta e envie três aprofundamentos.
5. Confirme que a quarta pergunta não é liberada.
6. Para testar resiliência, altere temporariamente `GEMINI_API_KEY` em um Preview, faça redeploy e confirme que a leitura local aparece sem bloco vermelho; não faça esse teste destrutivo em Production.

A resposta JSON da API inclui `meta.provider`, `meta.model` e `meta.usedFallbackModel`. A interface também grava `data-agent911-provider` nos blocos de leitura. Isso permite distinguir Gemini, modelo secundário e fallback sem enviar pergunta, nome ou e-mail para analytics.

## 3. Localhost usando a chave da Vercel

Instale e rode:

```bash
npm ci
npm run dev
```

O Vite encaminha `/api` para `https://arcane911.vercel.app`. Portanto, depois que a V10 estiver publicada, o localhost usa exatamente a mesma função e a chave que já está na Vercel. A chave não precisa existir no computador e nunca chega ao navegador.

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

Toda alteração `VITE_*` exige novo build/deploy.

## 5. Privacidade e limites reais

- No modo `live`, pergunta, cartas, posições e histórico curto da consulta são enviados ao provedor pelo servidor. Nome e e-mail do cadastro beta não entram nessa requisição.
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
