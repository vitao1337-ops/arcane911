# Auditoria V8 — Funil e Agente 911

Data: 11/08/2026  
Base congelada: `Arcane911-V7-AGENTE911.zip`  
SHA-256 da base: `650a96460fe369f265bcfb2535cb4e8dc7e71075b15590afcc24e08cff6cda04`

## Diagnóstico

1. O desenvolvimento usava Vite em `localhost:5173`, mas `/api/agent-911` existe como função serverless da Vercel. Sem proxy ou `vercel dev`, o navegador recebia uma resposta inválida/404 e exibia “O Agente 911 não conseguiu responder agora”.
2. A abertura entregava uma síntese estática e, logo abaixo, repetia a promessa em um painel grande do 911. Isso fragmentava a leitura, criava um clique desnecessário e afastava a conversão.
3. Memória, início da IA, aprofundamentos e oferta estavam misturados no mesmo painel.
4. Produtos específicos apareciam cedo demais, competindo com a progressão natural para a Ferradura completa.
5. Uma falha transitória da API removia a entrega principal e virava uma mensagem de erro visível.

## Arquitetura aplicada

### Abertura gratuita

- Mantém as três cartas, posições, legendas, luz, sombra e convite.
- Mostra uma única síntese pessoal do 911 automaticamente.
- Não pede cadastro, não mostra memória e não exige botão.
- A pergunta aparece dentro da leitura e é enviada junto das cartas somente após a revelação.
- A chamada é deduplicada em React Strict Mode e armazenada na sessão para não gastar duas vezes ao voltar de página.
- Falha de rede, timeout, limite ou configuração mantém uma síntese essencial já ancorada nas três cartas.
- O próximo passo é somente a Ferradura completa.

### Ferradura completa

- Preserva as três cartas e adiciona quatro escolhas reais.
- Mantém as sete legendas completas.
- Entrega uma única síntese automática mais profunda.
- Em seguida oferece a Consulta 911, claramente separada da leitura.

### Consulta 911

- O cadastro só aparece depois do clique em “Fazer uma consulta com o 911”.
- Pede nome completo e e-mail com validação inline.
- Nesta beta o cadastro fica local; não finge que existe uma conta server-side.
- Libera três perguntas ligadas à mesma pergunta, história e Ferradura.
- O ponto de integração de autenticação, checkout e créditos permanece isolado para a etapa comercial.

### Leituras específicas

- Foram removidas da abertura gratuita.
- Aparecem depois da síntese e da consulta na Ferradura.
- Funcionam como alternativa direta e de menor escopo, sem concorrer com o produto principal.

## Resiliência técnica

- `vite.config.js` encaminha `/api` no desenvolvimento para o deploy da Vercel, sem levar `OPENAI_API_KEY` ao navegador.
- Ações separadas: `opening_summary`, `complete_summary`, `initial_reading` e `follow_up`.
- A auditoria exige 3 cartas na abertura, 7 na síntese completa e cobertura de todas as cartas selecionadas.
- O modelo não pode inserir carta fora da mesa, certeza determinista ou memória sem consentimento.
- Resumos usam orçamento menor de saída para reduzir latência e custo.
- A rota continua usando `store: false`, Structured Output estrito, rate limit e segunda tentativa após rejeição da auditoria.

## Validação executada

- `npm test`: 35/35 contratos aprovados.
- `npm run build`: produção compilada com sucesso.
- Vite local: documento principal respondeu HTTP 200.
- Testes novos cobrem personalização de fallback, número de cartas por ação, ordem do funil, ausência do erro visual e cadastro somente na consulta.
- Bundle inicial permaneceu próximo da base; o motor astral continua em carregamento tardio.

## Publicação

1. Subir esta versão para o mesmo repositório conectado à Vercel.
2. Confirmar `OPENAI_API_KEY` em Production (e Preview se usado).
3. Manter `OPENAI_MODEL=gpt-5.6-terra` ou remover a variável para usar o mesmo padrão do código.
4. Fazer novo deploy: variáveis alteradas não entram retroativamente em deploy antigo.
5. Testar abertura automática, Ferradura, cadastro da consulta e três aprofundamentos.

O fallback impede quebra de experiência, mas o teste final da resposta gerada pelo modelo depende do novo deploy ter acesso à chave válida e faturamento ativo no provedor.
