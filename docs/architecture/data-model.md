# Modelo de dados conceitual

## Currículo

### Theme

- `id`
- `slug`
- `name`
- `description?`
- `status`: enabled, disabled
- `curriculumVersion`

O catálogo inicial contém apenas `fonemas`. Habilidades pertencem a um tema para
que novas áreas possam ser adicionadas sem alterar os contratos centrais.

### Skill

- `id`
- `themeId`
- `name`
- `description?`
- `objectives[]`

### Objective

- `id`
- `skillId`
- `name`
- `priorityStatement`
- `weeks[]`

### Week

- `id`
- `objectiveId`
- `number`
- `title`
- `contentSummary?`
- `lessons[]`

### Lesson

- `id`
- `weekId`
- `number`
- `specificObjective`
- `content`
- `defaultDurationMinutes?`
- `templateId?`

## Geração

### GenerationBatch

- `id`
- `lessonId`
- `themeId`
- `curriculumVersion`
- `requestedDurationMinutes`
- `requestedActivityCount`
- `normalizedParameters`
- `status`
- `createdAt`
- `promptVersion`
- `ruleSetVersion`
- `cacheKey`
- `cachedFromBatchId?`

### Activity

- `id`
- `batchId`
- `logicalActivityId`
- `slotIndex`
- `title`
- `description`
- `durationMinutes`
- `status`: draft, approved, rejected, superseded
- `version`
- `replacesActivityId?`
- `generationRunId`

Cada linha de `Activity` representa uma versão imutável. Regenerar cria uma nova
linha ligada à anterior; não sobrescreve a versão aprovada nem os dados usados
para produzi-la.

### ActivityRuleApplication

- `activityId`
- `activityVersion`
- `ruleId`
- `ruleVersion`
- `applicability`
- `applicabilityReason`
- `validationResultId`

Essa relação registra quais regras foram realmente avaliadas para cada versão de
atividade. A simples presença de uma regra no prompt não substitui esse registro.

## Regras e evidências

### Source

Referência bibliográfica ou documento oficial.

### EvidenceClaim

Afirmação atômica extraída de uma fonte, com localização e status de verificação.

### Rule

Regra operacional versionada.

### RuleSupport

Ligação entre regra e afirmação, com tipo `direct`, `inference` ou `contextual`.

### ValidationResult

- atividade;
- regra e versão;
- aplicabilidade;
- status;
- evidência textual;
- explicação;
- confiança;
- origem do avaliador.

## Revisão

### ReviewDecision

- `activityId` e versão;
- `decision`: approved, rejected;
- `feedback?`;
- `author`;
- `createdAt`.

### FeedbackProposal

- texto normalizado;
- escopo sugerido;
- status de aprovação;
- regra criada, se aplicável.

## Uso

### ModelRun

- lote e atividade opcional;
- etapa: plan, generate, validate, repair;
- provedor e modelo;
- entrada normalizada e seu hash;
- ID, versão e conteúdo renderizado do template de prompt;
- payload de resposta validado;
- chave de cache;
- execução original, quando o resultado for reutilizado;
- uso bruto;
- tokens normalizados;
- latência;
- erro opcional.

Somente execuções concluídas e validadas podem ser reutilizadas. Tokens de uma
reutilização não são contabilizados como nova chamada ao provedor.

## Cache de geração

### GenerationCacheEntry

- `cacheKey` único;
- `themeId`, aula e versão curricular;
- parâmetros normalizados;
- versão do prompt e do conjunto de regras;
- provedor e modelo;
- `modelRunId` da resposta validada;
- `createdAt` e `lastUsedAt`.

A entrada aponta para os registros rastreáveis; não guarda uma segunda cópia sem
origem do texto gerado.

## Relação principal

```text
Tema
└── Habilidade
    └── Objetivo
        └── Semana
            └── Aula
                └── Lote de geração
                    └── Atividade versionada
                        ├── execução e prompt do modelo
                        ├── regras aplicadas
                        ├── relatório de validação
                        └── decisão e feedback humano
```
