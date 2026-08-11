# Agente 911 — publicação

O Agente 911 já está integrado às tiragens de três e sete cartas. A chave nunca entra no JavaScript do navegador: a interface chama `POST /api/agent-911`, e a função da Vercel conversa com a OpenAI no servidor. A leitura pessoal começa automaticamente quando as cartas são reveladas.

## 1. Variáveis na Vercel

Em **Project Settings → Environment Variables**, mantenha:

```env
OPENAI_API_KEY=sk-sua-chave-real
OPENAI_MODEL=gpt-5.6-terra
VITE_AGENT911_ENABLED=true
```

- `OPENAI_API_KEY` é obrigatória e deve ser marcada como sensível.
- `OPENAI_MODEL` é opcional; sem ela, o código usa `gpt-5.6-terra`.
- `VITE_AGENT911_ENABLED` é opcional porque o agente já nasce ativo. Defina como `false` para desligá-lo rapidamente.
- Nunca crie `VITE_OPENAI_API_KEY`: tudo que começa com `VITE_` pode ir para o navegador.

Marque pelo menos **Production**. Se quiser testar em links de Preview, marque também **Preview**. Depois de salvar qualquer variável, faça um novo deploy; a Vercel não injeta a mudança em um deploy antigo.

## 2. Publicar

Suba os arquivos para o repositório conectado à Vercel. O `vercel.json` já reconhece a função `api/agent-911.js` e mantém o fallback das rotas React.

No primeiro teste em produção:

1. Abra `/tiragem-gratis`.
2. Faça a abertura de três cartas.
3. Confirme que a síntese pessoal aparece automaticamente, sem botão e sem cadastro.
4. Continue para a Ferradura, escolha as quatro cartas restantes e confirme a síntese completa.
5. Abra **Consulta 911**: somente nesse momento o cadastro deve aparecer.

Se aparecer “precisa da chave segura no servidor”, confira o nome exato `OPENAI_API_KEY`, o ambiente selecionado e se houve redeploy.

## 3. O que fica privado

- Pergunta e cartas são enviadas ao revelar a leitura; a interface avisa isso junto ao campo da pergunta.
- A requisição à OpenAI usa `store: false`.
- Nenhuma memória pessoal é enviada na síntese automática.
- O cadastro beta da consulta fica somente no navegador atual; não é tratado como conta server-side.
- O servidor reconstrói cartas, posições e significados pela Bíblia 911; textos enviados pelo navegador não substituem o cânone.

## 4. Teste local sem rota quebrada

`npm run dev` encaminha `/api` para `https://arcane911.vercel.app` por padrão. Assim, o localhost usa a função serverless sem copiar a chave para o computador. Para apontar a outro deploy:

```env
ARCANE911_DEV_API_TARGET=https://seu-preview.vercel.app
```

Se a rede ou o provedor falhar, a interface mantém uma síntese essencial feita com a pergunta, as posições e as cartas reais. Ela não mostra bloco vermelho nem apaga a leitura.

## 5. Antes de cobrar pelas perguntas

A interface já limita a consulta a três aprofundamentos e pede nome completo e e-mail somente ao abrir esse produto. A fase atual segue liberada e o cadastro é local. Para cobrar de verdade, conecte autenticação, pagamento e créditos a um banco server-side. Não use `localStorage` ou um contador enviado pelo navegador como prova de compra.

O encaixe futuro recomendado é: checkout confirmado → crédito gravado no servidor → rota 911 consome um crédito por pergunta → histórico opcional vinculado à conta.
