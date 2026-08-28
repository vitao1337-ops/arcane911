# Arcane911 V29 — correções de compra e entrega

Base: último ZIP V28 enviado em 27/08/2026. Identidade visual e 22 cartas preservadas. Mercado Pago: Pix e cartão.

## Rodar no localhost

Instale Node.js 22 LTS ou 24 LTS. Abra esta pasta no terminal:

```bash
npm ci
npm run dev
```

Abra o endereço exibido no terminal (normalmente http://localhost:5173). O comando prepara a base de cidades automaticamente, sem rede. No localhost, Tarot e Documento Astral usam mocks e acesso DEV por padrão: não há cobrança nem consumo de IA. Não copie chaves de produção para testar a aparência.

```bash
npm test
npm run build
```

Verificação desta entrega: 172 testes passaram e o build de produção foi concluído. Os testes de cobrança e IA usam provedores isolados; não comprovam saldo/cota das contas nem substituem uma compra real acompanhada.

A instalação ajusta automaticamente o formato de módulos da biblioteca astronômica para o Node da Vercel. Esse ajuste também é verificado sem a detecção automática de módulos do Node.

## Correções desta versão

- Dados de entrega registrados antes de abrir cobrança; pagamento confirmado inclui o PDF na fila sem depender da volta do navegador.
- Documento e respostas pagos salvos no banco junto com o consumo do crédito, com recuperação pelo código privado do pedido.
- Perguntas idênticas repetidas recuperam a mesma resposta; processamento abandonado vence após cinco minutos.
- Reembolso/chargeback revoga o acesso e não é desfeito por notificação antiga de aprovação.
- Pagamento em análise não é apresentado como recusa; Pix e cartão retomam a confirmação após recarregar. Recusa real permite nova tentativa com idempotência.
- Mapa oculto no cabeçalho antes da confirmação; dados de nascimento conferidos no servidor antes de pagar.
- Horários inexistentes são rejeitados e horários duplicados exigem confirmação. UTC e deslocamento ficam registrados na fila para revisão.
- Cidades GeoNames incluídas localmente, com licença que permite uso comercial. Veja ATTRIBUTION-GEONAMES.md.

## Banco: instalação e atualização

Execute nesta ordem, somente no projeto que já contém o Arcane911:

1. database/arcane911-payment-ledger.sql
2. database/arcane911-v29.sql

Depois confira:

```sql
select public.arcane911_payment_ledger_health(); -- ready=true, version=5
select public.arcane911_astral_fulfillment_health(); -- ready=true, version=2
```

Os scripts preservam os registros existentes. Nunca execute RESET-FOR-CLEAN-INSTALL.sql em produção. Os objetos desta atualização têm prefixo arcane911; não alteram objetos do Sorriso Marcado.

## Publicação

Somente main / Production, sem Preview. Banco e código devem ser atualizados juntos: a versão nova recusa cobranças se a migração não estiver pronta. Não publicar só o dist: as APIs também são necessárias. Variáveis privadas permanecem na Vercel; este ZIP não contém credenciais. Veja PAGAMENTOS-SETUP.md e .env.example.

## O que ainda depende da operação humana

- Usar hospedagem cujo plano permita operação comercial; Vercel Hobby não atende a essa finalidade.
- Confirmar a pessoa qualificada que revisa e envia os PDFs em 1–2 dias úteis. A V29 organiza a fila e preserva o conteúdo; não inventa uma revisão humana nem envia e-mail automaticamente.
- A pessoa revisora deve usar o instante birth_utc registrado e o método Zodíaco tropical / Casas Iguais. Nunca inferir novamente a ocorrência de horário de verão.
- Somente marcar o pedido como entregue depois de revisar, enviar e confirmar que o envio foi aceito. Guardar a comprovação do envio no atendimento.
- Manter cota/saldo da IA e limites de gasto na conta dos provedores. Tetos por requisição e estimativas do código não são um limite financeiro global da conta.
- Antes de tráfego pago: uma compra real com Pix, uma com cartão, retorno após fechar o navegador, recuperação em outro dispositivo, PDF recebido, cinco perguntas e reembolso.

## Limites e privacidade

A recuperação exige o código order-…; ele funciona como senha. Resultados de compras antigas, que nunca foram salvos pelo V28, não podem ser reconstruídos magicamente. Dados pagos e rascunhos de compra ficam em área privada; a exclusão solicitada deve ser tratada pelo suporte.

As posições planetárias são comparadas em dois motores; isso não certifica cientificamente a interpretação nem substitui a conferência profissional do horário, Ascendente e casas. Datas suportadas nesta versão: 1900 até hoje.
