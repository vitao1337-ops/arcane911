# Arcane911 V20 — auditoria atual

Data da run: 14/08/2026 (America/Sao_Paulo).

## Resultado executivo

- O código entregue está pronto para `npm ci`, testes, build e push no Git.
- O pacote final não contém `node_modules`, `dist`, `.git`, `.env`, caches, ZIPs internos nem relatórios históricos V7–V19.
- O visual aprovado foi preservado. A única nova superfície é o bloqueio comercial do Documento Astral, exibido somente quando um preço positivo for configurado.
- O mapa básico é calculado localmente. A IA do documento não é chamada antes da autorização comercial.
- O Documento Astral continua aberto enquanto `VITE_ASTRO911_PRICE_CENTS` estiver vazio; nenhum preço foi inventado nesta run.

## Documento Astral

Fluxo final:

1. validar nome, data, horário e coordenadas;
2. calcular localmente 10 planetas, 12 casas, Ascendente, Meio do Céu e aspectos;
3. exibir mandala e síntese calculada;
4. se o preço estiver vazio, manter a validação aberta;
5. se o preço estiver configurado, exibir o bloqueio comercial sem montar o componente de IA;
6. criar Stripe Checkout pelo servidor;
7. confirmar pagamento, valor, moeda, produto, pedido, fingerprint e contexto diretamente no Stripe;
8. somente então montar e solicitar o Documento Astral.

Correções aplicadas:

- datas impossíveis, futuras, horários e coordenadas fora da faixa são recusados;
- resultados de geocodificação inválidos são descartados;
- arredondamento de grau não produz mais `29°00'` por estouro de minutos;
- o entitlement precisa corresponder ao fingerprint do mapa atual, impedindo reaproveitamento acidental entre mapas;
- iniciar outro mapa limpa mapa e documento anteriores;
- mapa e documento usam `sessionStorage` com janela máxima de 12 horas;
- o armazenamento persistente legado é migrado apenas quando recente e depois removido;
- o checkout recebe apenas identificadores técnicos; não recebe nome, nascimento, cidade ou documento;
- valor vazio/zero do Documento Astral é recusado server-side, evitando cobrança acidental.

## Cobrança

Preços já aprovados e centralizados:

- Tiragem Completa: R$ 19,99;
- pergunta ao 911: R$ 5,00;
- pergunta específica após a Tiragem Completa: R$ 5,00;
- pergunta específica avulsa: R$ 10,00.

Documento Astral: valor deliberadamente não definido. Para ativar, configurar na Vercel:

```env
VITE_ASTRO911_PRICE_CENTS=SEU_VALOR_INTEIRO_EM_CENTAVOS
STRIPE_SECRET_KEY=sk_live_...
```

Antes de cobrar pessoas reais, usar `sk_test_...` em Preview e confirmar o retorno completo. A versão atual guarda autorizações na sessão do navegador; recuperação entre dispositivos, reembolso automatizado e entrega durável exigem banco/conta e webhook assinado antes de escalar tráfego pago.

## Vercel verificada

Projeto: `arcane911` (`prj_iLzuOX9xX8gatG7Tic6ji5kt6i5k`).

- domínio `https://arcane911.vercel.app` respondeu 200;
- `/mapa-astral` respondeu 200 e carregou a interface;
- deployment de produção observado: `dpl_CdE41H5pNJP7JckHa9yTWmxjM4Pq`, estado `READY`;
- build remoto terminou com sucesso;
- o deployment observado ainda compilou `arcane911@0.15.0`; portanto esta V20 ainda não está publicada;
- os logs agregados dos últimos sete dias mostram quota esgotada no Gemini (`RESOURCE_EXHAUSTED`) e também no fallback OpenAI (`insufficient_quota`/`credit_balance_exhausted`);
- houve um erro astral por quota no período;
- não foi possível confirmar presença de variáveis da Vercel porque o conector disponível não expõe a lista de nomes/ambientes. Nenhum segredo foi lido.

Conclusão operacional: hospedagem, domínio e build estão funcionando. A indisponibilidade real de IA vista em produção é financeira/de quota, não uma falha de rota. Repor saldo/quota dos providers é obrigatório antes de cobrar por entrega conectada.

## IA e custo

Os contratos automatizados confirmam:

- sucesso normal: 1 chamada;
- paráfrase semanticamente válida: 1 chamada;
- reparo estrutural: no máximo 2 chamadas no mesmo fluxo;
- fallback completo Gemini principal → Gemini reserva → OpenAI: no máximo 3 chamadas;
- clique duplo ou pedidos simultâneos idênticos: 1 promise/chamada compartilhada;
- DEV padrão: mock local, sem Gemini/OpenAI e sem Stripe;
- `agent911_usage` e `astro911_usage` registram tokens, chamadas, fallback, reparo e duração sem pergunta ou dados natais.

## Validação da run

- dependências de produção: `npm audit --omit=dev` → 0 vulnerabilidades;
- testes: 125 aprovados, 0 falhas;
- build de produção: aprovado, 1.614 módulos;
- lint: o projeto não possui script `lint`; nenhuma falha foi ocultada;
- busca de segredo: nenhuma chave real encontrada;
- `!important`: nenhuma ocorrência em `src`;
- mocks: protegidos por `import.meta.env.DEV`;
- localhost: sem target de produção silencioso.

## Conteúdo do pacote Git

Entram somente:

- configuração raiz necessária;
- `api/`, `server/`, `src/`, `public/` e `tests/`;
- README e guias operacionais atuais;
- este relatório consolidado.

Não entram:

- bundles gerados de `dist`;
- dependências instaladas;
- arquivos de ambiente reais;
- históricos `AUDITORIA-V7` a `AUDITORIA-V19`;
- artefatos do sistema operacional ou arquivos compactados aninhados.

`src/lib/agent911Memory.js` permanece intencionalmente preservado como infraestrutura reservada para memória server-side/conta consentida.
