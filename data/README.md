# Dados versionados

## Currículo

`data/curriculum.json` é a matriz canônica que será consumida pelo aplicativo.
Ela contém o tema “Fonemas” organizado em:

- 4 habilidades;
- 16 objetivos;
- 16 semanas;
- 80 aulas.

O frontend não deve conhecer a estrutura da planilha que originou esses dados.
Carregamento, validação e filtros devem operar sobre o contrato canônico descrito
em `docs/architecture/curriculum-json-contract.md`.

## Regras de uso

- preservar a ordem dos arrays;
- usar os IDs determinísticos nos filtros e relações persistidas;
- nunca alterar habilidades, objetivos ou conteúdos durante a geração por IA;
- validar o arquivo na fronteira de entrada antes de expô-lo à aplicação;
- tratar `defaultDurationMinutes` como configuração inicial da aula, não como
  autorização para alterar a duração solicitada pelo usuário.

## Catálogo de regras

`data/rules.json` é o seed versionado das 32 regras documentadas em
`docs/research/rule-catalog.md`: 28 regras iniciais e quatro regras estruturais
da validação determinística. Cada entrada usa o contrato tipado de regra do
domínio; antes do uso, o catálogo deve passar por `loadRuleCatalog`.

Somente entradas com status `active` podem compor novos lotes. Regras `draft`
ou `retired` permanecem rastreáveis no catálogo, mas são excluídas por
`selectActiveRules`.
