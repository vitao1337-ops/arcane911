# Arcane911 V31 — Agent911 + revisão humana + PDF privado

Base: V30 de lançamento localhost. Identidade visual e 22 cartas preservadas. Mercado Pago: Pix e cartão.

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

Verificação desta entrega: 184 testes passaram e o build de produção foi concluído. Os testes de cobrança, Storage, e-mail e IA usam provedores isolados; não comprovam saldo/cota das contas nem substituem uma compra real acompanhada.

A instalação ajusta automaticamente o formato de módulos da biblioteca astronômica para o Node da Vercel. Esse ajuste também é verificado sem a detecção automática de módulos do Node.

## Entrega desta versão

- Três blocos de autorrelato entram no snapshot imutável antes do Mercado Pago e personalizam a escrita do Agent911.
- Bancada privada e não anunciada em `/admin/mapas`, protegida por segredo server-side.
- Rascunho Arcane de 21 páginas, editável página por página e preparado para **Imprimir / salvar PDF**.
- Uma carta do próprio Arcane911 aparece em fade em cada página, sem bolas ou decoração genérica.
- PDF revisado vai para bucket privado no Supabase Storage e nunca recebe URL pública permanente.
- Aprovação em duas etapas: e-mail precisa ser aceito antes de o pedido virar entregue e liberar cinco perguntas.
- Cliente pode gerar novo link privado de download no próprio mapa após a entrega.
- Notificação opcional ao revisor usa `REVIEWER_EMAIL`; o exemplo permanece inerte até ser trocado.

## Banco: instalação e atualização

Execute nesta ordem, somente no projeto que já contém o Arcane911:

1. database/arcane911-payment-ledger.sql
2. database/arcane911-v29.sql
3. database/arcane911-v31.sql

Depois confira:

```sql
select public.arcane911_payment_ledger_health(); -- ready=true, version=5
select public.arcane911_astral_fulfillment_health(); -- ready=true, version=3
```

Os scripts preservam os registros existentes. Nunca execute RESET-FOR-CLEAN-INSTALL.sql em produção. Os objetos desta atualização têm prefixo arcane911; não alteram objetos do Sorriso Marcado.

## Publicação

Somente main / Production, sem Preview. Banco e código devem ser atualizados juntos: a versão nova recusa cobranças se a migração não estiver pronta. Não publicar só o dist: as APIs também são necessárias. Variáveis privadas permanecem na Vercel; este ZIP não contém credenciais. Veja PAGAMENTOS-SETUP.md e .env.example.

## O que ainda depende de você

- Usar hospedagem cujo plano permita operação comercial; Vercel Hobby não atende a essa finalidade.
- Revisar cada página como tarólogo responsável antes de clicar em **Aprovar e enviar**.
- Verificar domínio/remetente no Resend e substituir os endereços `example.com`.
- Guardar o segredo administrativo fora do código e das variáveis `VITE_`.
- Manter cota/saldo da IA e limites de gasto na conta dos provedores. Tetos por requisição e estimativas do código não são um limite financeiro global da conta.
- Antes de tráfego pago: uma compra real com Pix, uma com cartão, retorno após fechar o navegador, recuperação em outro dispositivo, PDF recebido, cinco perguntas e reembolso.

Veja o passo a passo curto em `REVISAO-HUMANA-V31.md`.

## Limites e privacidade

A recuperação exige o código order-…; ele funciona como senha. Resultados de compras antigas, que nunca foram salvos pelo V28, não podem ser reconstruídos magicamente. Dados pagos e rascunhos de compra ficam em área privada; a exclusão solicitada deve ser tratada pelo suporte.

As posições planetárias são comparadas em dois motores; isso não certifica cientificamente a interpretação nem substitui a conferência profissional do horário, Ascendente e casas. Datas suportadas nesta versão: 1900 até hoje.
