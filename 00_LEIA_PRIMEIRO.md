# Arcane911 V24 · base limpa Mercado Pago

Esta é a base limpa do Arcane911 depois da retirada completa do provedor anterior.

## Regra desta versão

- pagamento: Mercado Pago;
- meios visíveis: cartão de crédito e Pix;
- checkout: Payment Brick oficial dentro de `/pagamento`;
- backend: `/api/payment` cria o pagamento e nunca aceita preço do navegador;
- confirmação: `/api/payment-status` consulta o pagamento no Mercado Pago antes de liberar acesso;
- webhook: `/api/mercadopago-webhook`, com validação HMAC da assinatura;
- ledger: Supabase privado com IDs `mp-...` e schema versão 4;
- ambiente de desenvolvimento continua mock/gratuito por padrão;
- nenhuma credencial real faz parte deste ZIP.

## Antes de vender

1. Configure as variáveis de `PAGAMENTOS-SETUP.md` em Production.
2. Em um Supabase novo, execute `database/arcane911-payment-ledger.sql`.
3. Se o projeto ainda contém um ledger antigo e não houve venda real, execute primeiro `database/RESET-FOR-CLEAN-INSTALL.sql` e depois o ledger V24.
4. Cadastre o webhook de pagamentos no painel do Mercado Pago apontando para `https://arcane911.vercel.app/api/mercadopago-webhook`.
5. Faça uma compra real de valor baixo somente quando os dados legais e de suporte estiverem preenchidos.

O projeto deve ser validado localmente e só depois enviado para Production.
