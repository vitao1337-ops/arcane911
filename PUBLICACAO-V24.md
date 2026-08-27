# Publicação V24 · direto para Production

1. `npm ci`
2. `npm test`
3. `npm run build`
4. busca por resíduos proibidos (referências ao provedor removido, chaves reais e arquivos `.env`)
5. commit único no Git
6. deploy desse mesmo commit em Production
7. smoke test de homepage, leitura grátis, `/pagamento`, recuperação de compra e APIs

Não use deploys soltos `gitDirty` como fonte definitiva. O ZIP, o Git e Production devem apontar para o mesmo conteúdo.
