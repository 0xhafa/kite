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

Os preços ficam isolados em uma tabela de domínio versionada, separada da lógica
de agregação. A interface mostra o valor como estimativa em dólar, usando as
tarifas padrão de entrada e saída e sem antecipar descontos de cache; o valor
faturado pelo provedor pode variar.

## Métricas futuras

- tokens por minuto de atividade produzida;
- tokens por atividade aprovada;
- número médio de reparos;
- regras que mais provocam falhas;
- diferença entre lotes com e sem feedback.
