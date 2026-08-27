# Arcane911 V24

React 18 + Vite + Vercel para Tarot, Agent 911 e Documento Astral. Esta base foi saneada para usar somente Mercado Pago no comércio.

## Scripts

```bash
npm ci
npm test
npm run build
npm run dev
```

## Pagamentos

- `/pagamento`: Payment Brick oficial;
- `/api/checkout`: pré-voo do pedido;
- `/api/payment`: criação de cartão/Pix;
- `/api/payment-status`: confirmação server-side;
- `/api/mercadopago-webhook`: confirmação assíncrona assinada;
- `/api/order-status`: recuperação por código `order-...`;
- `server/checkout-core.js`: catálogo, idempotência, integração Mercado Pago e validação;
- `server/payment-ledger.js`: RPCs do ledger privado;
- `database/arcane911-payment-ledger.sql`: schema V24 neutro ao provedor.

O navegador nunca define o preço final. O backend usa `src/config/productCatalog.js` como catálogo confiável.

## Produtos padrão

- Tiragem Completa: R$ 19,99;
- Pergunta ao 911: R$ 5,00;
- Pergunta específica dentro da Ferradura: R$ 5,00;
- Pergunta específica avulsa: R$ 10,00;
- Documento Astral: fechado até preço positivo ser configurado.

## IA

Gemini permanece principal com fallback opcional OpenAI. DEV continua mock/gratuito por padrão. Consulte `AGENTE911-SETUP.md`.

## Publicação

O fluxo operacional é: validar localmente, consolidar no Git e publicar o mesmo commit em Production.

Leia `00_LEIA_PRIMEIRO.md` e `PAGAMENTOS-SETUP.md` antes de ativar cobrança.
