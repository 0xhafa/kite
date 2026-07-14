# Fluxos do usuário

## Fluxo 1 — seleção curricular

1. selecionar um tema, inicialmente com “Fonemas” como única opção;
2. selecionar uma habilidade pertencente ao tema;
3. selecionar um objetivo pertencente à habilidade;
4. opcionalmente selecionar semana e aula;
5. visualizar objetivo específico e conteúdo;
6. avançar para configuração.

Se o usuário selecionar apenas tema, habilidade ou objetivo, o sistema deve
levá-lo até uma aula concreta antes de gerar. A geração nunca ocorre em um
contexto curricular indefinido.

## Fluxo 2 — configuração

1. confirmar aula;
2. informar duração total, padrão 25 minutos;
3. informar quantidade de atividades;
4. visualizar distribuição estimada do tempo;
5. gerar.

## Fluxo 3 — revisão do lote

1. visualizar uma atividade por vez ou uma pilha curta;
2. ler conteúdo, duração e resumo da validação;
3. abrir detalhes dos critérios quando necessário;
4. aprovar, rejeitar ou editar;
5. avançar para a próxima atividade.

## Fluxo 4 — rejeição e regeneração

1. rejeitar atividade;
2. informar feedback opcional;
3. escolher escopo sugerido: apenas regeneração, sessão ou candidato a regra;
4. regenerar somente aquela posição;
5. validar a substituta também contra as atividades preservadas;
6. manter a mesma duração individual.

## Fluxo 5 — inspeção

O usuário pode abrir:

- regras aplicáveis;
- status de cada regra;
- evidência encontrada na atividade;
- origem acadêmica, inferida ou editorial;
- tokens consumidos em geração, validação e reparo.
