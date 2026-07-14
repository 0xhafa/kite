# Observabilidade de tokens

## Objetivo

Permitir análise posterior de custo e eficiência sem acoplar o domínio ao formato de um único provedor.

## Registro por execução

Para cada chamada ao modelo, salvar:

- etapa: planejamento, geração, validação ou reparo;
- lote e atividade relacionados;
- provedor e modelo;
- timestamp e latência;
- uso bruto retornado pelo provedor;
- tokens de entrada, saída e outros tipos disponíveis;
- erro ou cancelamento;
- versão do prompt e das regras.

## Agregações da interface

### Por lote

- total de tokens;
- geração;
- validação;
- reparos;
- número de chamadas.

### Por atividade

- custo de criação inicial;
- custo de validação;
- custo de regenerações.

## Custos monetários

Não codificar preços diretamente na lógica. Se a POC mostrar custo estimado, usar uma tabela versionada de preços e deixar claro que é uma estimativa.

## Métricas futuras

- tokens por minuto de atividade produzida;
- tokens por atividade aprovada;
- número médio de reparos;
- regras que mais provocam falhas;
- diferença entre lotes com e sem feedback.
