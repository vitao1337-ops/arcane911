# Arcane911 V22 — roteiro de publicação

Use este arquivo como checklist. O ZIP vem sem `.git`, `.env`, `node_modules` e `dist`.

## 1. Validar no computador

1. Descompacte o ZIP em uma pasta nova.
2. Abra o terminal nessa pasta.
3. Confirme Node.js 20.19+:

```bash
node --version
```

4. Instale exatamente o lockfile e valide:

```bash
npm ci
npm test
npm run build
```

5. Para olhar a interface local sem custo de IA:

```bash
npm run dev -- --host 127.0.0.1
```

O DEV usa mocks locais e libera produtos pagos apenas nesse ambiente.

## 2. Publicar no Git sem apagar o histórico

No repositório atual:

```bash
git status
git switch -c release/arcane911-v22
```

Copie os arquivos da V22 para a raiz do repositório, preservando a pasta `.git`. Não copie `.env`, `node_modules`, `dist` nem o próprio ZIP.

Depois:

```bash
git status
git add .
git commit -m "release: Arcane911 V22"
git push -u origin release/arcane911-v22
```

Abra um Pull Request, revise o diff e só então faça merge. Se `git status` mostrar arquivos de outro projeto ou segredos, pare e corrija antes de `git add`.

## 3. Criar a infraestrutura de Preview

1. Crie um Supabase exclusivo do Arcane911.
2. Execute `database/arcane911-payment-ledger.sql`.
3. Confirme `{"ready": true, "version": 2}`.
4. Configure as variáveis de **Preview** na Vercel conforme `.env.example`.
5. Faça um deploy de Preview.
6. Crie o webhook Stripe de teste para `/api/stripe-webhook`.
7. Adicione o `STRIPE_WEBHOOK_SECRET` e redeploy.

Siga a ordem detalhada de `PAGAMENTOS-SETUP.md`.

## 4. Revisar as quatro telas públicas novas

- `/recuperar-compra`
- `/termos`
- `/privacidade`
- `/reembolsos`

Preencha nome legal e e-mail de suporte. Peça revisão jurídica antes de venda real. Cadastre no Stripe os Termos públicos antes de ativar `STRIPE_REQUIRE_TERMS_ACCEPTANCE=true`.

## 5. Fazer o teste ponta a ponta

1. leitura gratuita;
2. checkout de R$ 19,99 em modo teste;
3. webhook HTTP 200;
4. linha no ledger;
5. Ferradura e síntese 911;
6. recuperação pelo `order-…`;
7. Pergunta ao 911 consumida uma única vez;
8. pergunta específica de R$ 5 e avulsa de R$ 10;
9. cancelamento, repetição da URL e falha do provider;
10. logs sem conteúdo íntimo.

## 6. Promover para produção

1. Faça merge somente depois do Preview aprovado.
2. Configure as variáveis de Production.
3. Troque Stripe para `sk_live_...`.
4. Crie um webhook live separado e use seu `whsec_...`.
5. Confirme domínio, páginas legais e suporte.
6. Faça o deploy.
7. Execute uma compra real controlada.
8. Monitore Stripe, webhook, Supabase e logs.

## 7. O que continua deliberadamente pendente

- decidir o preço do Documento Astral;
- revisão jurídica e dados empresariais finais;
- configurar um destino de analytics somente com a governança de consentimento adequada;
- processo humano de suporte e reembolso;
- comprovar custo e margem reais.

Tráfego pago continua pausado até a margem unitária permanecer positiva no pior cenário razoável. O teto de R$ 1,00 do Agent 911 é uma proteção técnica, não autorização para anunciar.
