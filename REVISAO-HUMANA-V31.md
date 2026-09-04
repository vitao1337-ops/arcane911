# Arcane911 V31 · tutorial breve

## O que esta versão faz

1. A pessoa responde aos dados natais e a três blocos curtos de autorrelato.
2. O Mercado Pago confirma a compra e cria o pedido na fila privada.
3. O Agent911 escreve uma versão própria para o PDF usando mapa + autorrelato.
4. Você abre `/admin/mapas`, revisa cada uma das 21 páginas e salva as alterações.
5. Use **Imprimir / salvar PDF** e escolha **Salvar como PDF** no navegador.
6. Volte à bancada e use **Anexar PDF revisado**.
7. Confira o arquivo anexado. Só então use **Aprovar e enviar**.
8. O cliente recebe um link privado por e-mail e as cinco perguntas são liberadas.

Nada é enviado ao cliente antes do seu clique final.

## Instalação técnica

### 1. Banco

Se a V29 já está no Supabase, abra o SQL Editor e execute:

`database/arcane911-v31.sql`

Depois rode:

```sql
select public.arcane911_payment_ledger_health();
select public.arcane911_astral_fulfillment_health();
```

Resultados esperados: ledger versão 5 e fila astral versão 3, ambos com `ready: true`.

### 2. Variáveis da Vercel

Adicione em Production:

```env
ASTRO911_ADMIN_SECRET=gere-um-segredo-longo-e-unico
REVIEWER_EMAIL=reviewer@example.com
RESEND_API_KEY=
ARCANE911_FROM_EMAIL=Arcane911 <noreply@example.com>
ASTRO911_PDF_BUCKET=arcane911-astral-pdfs
```

- O e-mail `reviewer@example.com` é propositalmente inerte. Troque quando quiser receber aviso de venda.
- Cadastre e verifique um domínio no Resend; depois preencha a chave e um remetente real desse domínio.
- O bucket privado é criado automaticamente no primeiro upload. A chave secreta do Supabase precisa continuar somente no servidor.

### 3. Publicar e testar

Publique o projeto completo na Production, não apenas a pasta `dist`. Depois:

1. Faça uma compra real de valor controlado.
2. Confira se o pedido aparece em `/admin/mapas`.
3. Gere e revise o rascunho.
4. Salve e anexe o PDF.
5. Aprove e confirme o recebimento no e-mail do comprador.
6. Volte ao mapa como cliente e teste **Baixar minha síntese em PDF**.
7. Faça uma das cinco perguntas.

Sem Vercel Pro, continue fazendo localhost, banco, domínio, Resend e compra controlada. Não envie tráfego pago nem opere comercialmente na Hobby.

## Segurança prática

- Não coloque segredo em variável com prefixo `VITE_`.
- Não mande o `ASTRO911_ADMIN_SECRET` por chat ou e-mail.
- O segredo fica no `sessionStorage`: ao fechar a aba, a bancada pede novamente.
- O PDF aceita no máximo 2,7 MB para permanecer abaixo do limite de corpo da função.
- O link do e-mail dura sete dias; o botão do site gera outro link privado por 24 horas.
