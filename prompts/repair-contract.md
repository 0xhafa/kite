# Contrato de reparo e regeneração

## Entrada

- atividade atual ou posição rejeitada;
- duração obrigatória;
- falhas da validação;
- feedback do usuário;
- atividades preservadas;
- contexto curricular mínimo;
- regras aplicáveis.

## Objetivo

Produzir uma substituta para a mesma posição sem modificar o restante do lote.

## Originalidade da substituta

- trate a atividade rejeitada, as atividades preservadas e eventuais atividades descritas em `curriculum.lesson.content` como referências negativas de forma, não como moldes;
- preserve somente os invariantes curriculares e as restrições válidas;
- conceba silenciosamente pelo menos três alternativas e escolha a que mais se distancia das referências sem perder correção pedagógica;
- não se limite a trocar título, vocabulário, personagens ou materiais: mude a mecânica central e, quando o feedback não determinar outra coisa, pelo menos mais duas dimensões entre ação da criança, participação, espaço, canal sensorial, materiais e evidência de aprendizagem;
- não copie nem parafraseie a sequência de etapas, as falas ou a lista de estímulos das referências;
- repetir o fonema, a letra, a operação ou outro conteúdo indispensável ao objetivo não conta como cópia.

## Regras

- preservar duração individual;
- não repetir ação, contexto ou dinâmica rejeitada quando isso fizer parte do feedback;
- resolver falhas bloqueantes;
- manter objetivo e conteúdo;
- gerar nova versão com referência à atividade substituída;
- não alterar atividades aprovadas.

## Formatação da descrição

- quando essas partes existirem, usar parágrafos curtos iniciados exatamente por `Recursos:`, `Preparação:`, `Apresentação:`, `Ações:` e `Transição e encerramento:`;
- separar as partes aplicáveis com uma linha em branco (`\n\n`);
- omitir partes que não se aplicam, sem inventar etapas para completar a estrutura.
