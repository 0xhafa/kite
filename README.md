# Kite — POC de geração e revisão de atividades

Kite é uma prova de conceito do projeto Fonemas para gerar atividades pedagógicas a partir de uma matriz curricular estruturada, validar cada atividade contra regras pedagógicas e editoriais e permitir aprovação, rejeição e regeneração pontual.

## Executar localmente

Pré-requisito: Node.js 20.9 ou superior.

```bash
npm install
cp .env.example .env.local
npm run dev
```

A aplicação ficará disponível em `http://localhost:3000`. Por padrão, ela usa o
provedor mock determinístico e cria ou atualiza automaticamente o banco libSQL
local na primeira operação persistida.

## Banco local

O desenvolvimento usa libSQL em `.data/kite.db` por padrão. O diretório e
arquivos SQLite são ignorados pelo Git. Para criar ou atualizar o banco
manualmente a partir das migrations versionadas:

```bash
npm run db:migrate
```

Ao alterar o schema Drizzle durante uma tarefa que autorize essa mudança, gere a
próxima migration com `npm run db:generate`.

## Provedor de IA

O arquivo `.env.example` documenta os dois modos disponíveis:

- `AI_PROVIDER=mock`: padrão local e dos testes, sem chave externa;
- `AI_PROVIDER=http`: endpoint compatível com Chat Completions, configurado
  somente no servidor com `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` e, se
  necessário, `AI_TIMEOUT_MS`.

Não use prefixo `NEXT_PUBLIC_` em segredos. Respostas do provedor passam pelos
schemas tipados antes de serem persistidas ou exibidas.

## Qualidade

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

Na primeira execução do teste E2E, instale o navegador com
`npx playwright install chromium`.

Os testes E2E iniciam a aplicação na porta dedicada `4173`. O build de revisão
pode ser verificado com:

```bash
npm run build -- --webpack
```

## Objetivo da POC

Demonstrar o fluxo completo:

1. selecionar habilidade, objetivo, semana e aula;
2. definir duração total e quantidade de atividades;
3. gerar um grupo de atividades coerente com o currículo;
4. validar automaticamente cada atividade;
5. revisar, aprovar ou rejeitar individualmente;
6. regenerar apenas a atividade rejeitada, preservando sua duração;
7. exibir consumo de tokens por lote e por etapa.

## Estrutura da documentação

- `AGENTS.md`: instruções permanentes e curtas para os agentes de desenvolvimento.
- `LOOP.md`: protocolo do loop por sessões independentes.
- `docs/context/`: objetivo pedagógico, restrições e glossário.
- `docs/product/`: escopo, fluxos, UX e critérios de aceitação.
- `docs/product/brand-identity.md`: variações, regras e plano da identidade visual conceitual.
- `docs/architecture/`: modelo de dados, pipeline de IA e arquitetura técnica.
- `docs/research/`: fontes, afirmações e catálogo rastreável de regras.
- `docs/decisions/`: decisões arquiteturais já tomadas.
- `prompts/`: contratos de geração, validação e reparo.
- `tasks/`: backlog executável pelo loop e estado persistente.
- `data/`: local reservado para a matriz curricular em JSON.

## Regra de leitura para agentes

Não leia toda a documentação a cada sessão. Comece por `AGENTS.md`, depois `tasks/STATE.md`, o arquivo da tarefa atual e apenas os documentos indicados nela.

## Estado atual

A POC implementa o fluxo integrado de seleção curricular, configuração, geração,
validação, revisão, aprovação, rejeição e regeneração isolada. Lotes, decisões,
relatórios, versões e consumo de tokens são persistidos em libSQL e reconstruídos
ao recarregar a revisão.

A matriz curricular canônica de Fonemas está em `data/curriculum.json`, com 4
habilidades, 16 objetivos, 16 semanas e 80 aulas. O JSON é validado na fronteira
de importação; objetivos e conteúdos curriculares são exibidos sem alteração pela
IA. A interface cobre estados de carregamento, erro e vazio e possui fluxos E2E
para teclado e largura móvel.
