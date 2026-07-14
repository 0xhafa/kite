# Critérios de aceitação da POC

## Currículo

- O aplicativo carrega o JSON e apresenta a hierarquia correta.
- Uma aula exibe objetivo específico e conteúdo sem alteração pela IA.
- Erros estruturais no JSON produzem mensagem clara.

## Configuração

- A duração padrão é 25 minutos.
- O usuário pode informar outra duração válida.
- A quantidade de atividades é configurável dentro de limites definidos.
- A soma das durações individuais é igual à duração total.

## Geração

- O lote é retornado em estrutura tipada.
- Cada atividade referencia a aula selecionada.
- Cada atividade possui duração, conteúdo e versão.
- A geração não altera o currículo.

## Validação

- Toda atividade possui regras aplicáveis e resultados.
- Resultados sem evidência não podem aparecer como `passed`.
- Regras não aplicáveis aparecem como `not_applicable`, não como falha.
- O usuário consegue abrir a origem e a evidência de uma regra.

## Revisão

- Aprovar uma atividade preserva seu conteúdo.
- Rejeitar aceita feedback opcional.
- Regenerar troca apenas a atividade rejeitada.
- A substituta mantém a duração da atividade rejeitada.
- As demais atividades e a duração total não mudam.

## Tokens

- O lote mostra tokens totais.
- O sistema separa, quando fornecido pelo provedor, entrada e saída.
- O consumo é discriminado por geração, validação e reparo.
- Dados brutos de uso do provedor são preservados para auditoria.

## UX

- O fluxo principal pode ser concluído sem treinamento.
- Estados de carregamento, vazio e erro são visíveis.
- A interface funciona por teclado nos controles essenciais.
