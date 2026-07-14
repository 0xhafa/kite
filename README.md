# Kite — POC de geração e revisão de atividades

Kite é uma prova de conceito do projeto Fonemas para gerar atividades pedagógicas a partir de uma matriz curricular estruturada, validar cada atividade contra regras pedagógicas e editoriais e permitir aprovação, rejeição e regeneração pontual.

## Executar localmente

Pré-requisito: Node.js 20.9 ou superior.

```bash
npm install
npm run dev
```

A aplicação ficará disponível em `http://localhost:3000`.

## Banco local

O desenvolvimento usa libSQL em `.data/kite.db` por padrão. O diretório e
arquivos SQLite são ignorados pelo Git. Para criar ou atualizar o banco a partir
das migrations versionadas:

```bash
cp .env.example .env.local
npm run db:migrate
```

Ao alterar o schema Drizzle durante uma tarefa que autorize essa mudança, gere a
próxima migration com `npm run db:generate`.

## Qualidade

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

Na primeira execução do teste E2E, instale o navegador com
`npx playwright install chromium`.

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

O bootstrap da aplicação e a identidade visual conceitual estão disponíveis. A
matriz curricular canônica de Fonemas está em `data/curriculum.json`, com 4
habilidades, 16 objetivos, 16 semanas e 80 aulas. O importador e a navegação ainda
serão implementados pelas tarefas do backlog.
