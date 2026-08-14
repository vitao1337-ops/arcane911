# Arcane911 — checkout pronto com Stripe

## Passos para cobrar

O funil usa o **Stripe Checkout hospedado**. Não é preciso criar links de pagamento nem copiar preços para quatro telas diferentes.

1. Crie ou abra uma conta Stripe.
2. Copie a chave secreta do ambiente desejado.
3. Na Vercel, abra **Settings → Environment Variables**.
4. Cadastre a variável abaixo e faça um novo deploy:

```env
STRIPE_SECRET_KEY=sk_live_...
```

Use `sk_test_...` em Preview e `sk_live_...` somente em Production. A chave não usa prefixo `VITE_` e nunca entra no JavaScript público.

As quatro ofertas com preço aprovado funcionam apenas com essa chave. O Documento Astral permanece aberto enquanto seu preço estiver vazio; quando o preço comercial for decidido, cadastre também `VITE_ASTRO911_PRICE_CENTS` com um inteiro em centavos e faça novo deploy.

## Produtos e valores

| Produto | Valor | Regra de liberação |
|---|---:|---|
| Tiragem Completa | R$ 19,99 | Uma Ferradura de 7 cartas ligada à abertura atual |
| Pergunta ao 911 | R$ 5,00 | Um crédito; consumido somente depois de uma resposta concluída |
| Pergunta específica depois da Tiragem Completa | R$ 5,00 | Exige a compra paga da mesma Ferradura |
| Pergunta específica avulsa | R$ 10,00 | Uma leitura direcionada de 5 cartas |
| Documento Astral 911 | A definir | O cálculo básico abre; o documento longo só inicia após pagamento confirmado quando o preço for configurado |

Os valores padrão ficam em `src/config/productCatalog.js`. O servidor recria produto e valor usando esse catálogo; campos como `price` ou `priceCents` enviados pelo navegador são ignorados. O servidor recusa o Documento Astral com valor vazio ou zero, evitando cobrança acidental.

## Caminho validado

1. O botão envia somente produto, ID do pedido, ID da leitura e contexto comercial para `POST /api/checkout`.
2. A função server-side confere produto, rota de retorno e elegibilidade do desconto.
3. A função cria uma sessão do Stripe com o valor confiável em BRL.
4. O navegador é enviado para `https://checkout.stripe.com/...`.
5. O Stripe retorna para a mesma rota do Arcane com o ID da sessão.
6. O Arcane chama `POST /api/checkout-session`.
7. O servidor busca a sessão diretamente no Stripe e confere `paid`, valor, moeda, produto, pedido e leitura.
8. Só então a autorização desta sessão é salva e a experiência é liberada.

Uma URL de sucesso falsificada não concede acesso. Pagamento pendente, valor divergente, produto diferente ou leitura diferente também não liberam conteúdo.

## Privacidade

O checkout não recebe:

- a pergunta pessoal;
- cartas sorteadas;
- texto da leitura;
- nome ou dados do cadastro do Agent 911;
- conteúdo do Documento Astral.

Somente identificadores técnicos curtos entram nos metadados. A chave do Stripe, Gemini e OpenAI permanece server-side.

## Perguntas específicas

As cinco rotas funcionam de ponta a ponta:

- `/leituras/amor`
- `/leituras/caminhos`
- `/leituras/trabalho`
- `/leituras/decisao`
- `/leituras/interior`

Fluxo avulso: escrever a pergunta → pagar R$ 10,00 → embaralhar → escolher 5 cartas → revelar → receber leitura por posição e síntese 911.

O Arcane oferece somente a leitura específica correspondente à intenção escolhida na tiragem anterior. Fluxo depois da Ferradura: abrir esse bloco contextual → o servidor confirma a compra-mãe → pagar R$ 5,00 → seguir a mesma experiência de 5 cartas. O parâmetro `?origem=tiragem-completa` sozinho nunca concede o desconto em produção.

## Perguntas ao Agent 911

Cada compra de R$ 5,00 concede exatamente um crédito. O crédito só é consumido quando a resposta termina com sucesso. Timeout ou indisponibilidade de IA preserva o crédito. O máximo continua em três perguntas ligadas à mesma Ferradura.

## Documento Astral

Fluxo: calcular o mapa localmente → ver síntese e mandala → pagar o valor configurado → confirmar a sessão diretamente no Stripe → montar o Documento Astral. O componente que chama `/api/astro-911` nem sequer é montado antes da autorização, portanto abrir o mapa ou chegar ao bloqueio comercial não consome IA.

O checkout recebe somente produto, pedido, contexto comercial e um fingerprint curto derivado das posições calculadas. Nome, nascimento, cidade e conteúdo não são enviados ao Stripe. A autorização vale para aquele mapa na sessão atual; persistência entre dispositivos exigirá conta e banco na etapa futura.

## DEV gratuito

O padrão recomendado é:

```env
ARCANE911_DEV_REAL_AI=false
ARCANE911_DEV_API_TARGET=
ARCANE911_DEV_UNLOCK_PAID=true
```

Com `npm run dev`, Tiragem Completa, perguntas ao 911, perguntas específicas e Documento Astral podem ser percorridos sem cobrança. O Agent 911 e o Documento Astral usam mock local. Nenhuma chamada Gemini, OpenAI ou Stripe é feita.

Para ligar IA real deliberadamente em DEV, defina `ARCANE911_DEV_REAL_AI=true` e informe um `ARCANE911_DEV_API_TARGET` explícito. Não existe fallback silencioso para produção.

## Catálogo opcional por ambiente

Os valores já têm os padrões aprovados. Só altere estas variáveis se quiser mudar o catálogo inteiro de um ambiente:

```env
VITE_COMPLETE_READING_PRICE_CENTS=1999
VITE_AGENT911_QUESTION_PRICE_CENTS=500
VITE_SPECIFIC_QUESTION_COMPLETE_PRICE_CENTS=500
VITE_SPECIFIC_QUESTION_STANDALONE_PRICE_CENTS=1000
VITE_ASTRO911_PRICE_CENTS=
```

## Limite deliberado desta versão

A confirmação imediata do cartão está pronta e segura para a mesma sessão do navegador. Para entrega durável entre dispositivos, reembolso automatizado e recuperação por conta, a próxima etapa é persistir autorizações em banco e processar webhooks assinados do Stripe. Essa evolução não é necessária para percorrer e validar o checkout atual, mas é recomendada antes de escalar tráfego pago.

O preço do Documento Astral continua deliberadamente vazio. O fluxo seguro já está implementado; definir `VITE_ASTRO911_PRICE_CENTS` ativa a cobrança sem link manual e sem liberar conteúdo apenas pelo redirecionamento.
