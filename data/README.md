# Dados curriculares

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
