# ADR-002 — Rastreabilidade por regras e evidências

## Status

Aceita.

## Decisão

Fontes acadêmicas não serão ligadas diretamente às atividades. O sistema manterá a cadeia fonte → afirmação → regra → validação → evidência da atividade.

## Motivos

- evita bibliografia decorativa;
- separa evidência de decisões editoriais;
- permite versionamento;
- torna a validação auditável.

## Consequências

O modelo de dados e a UI precisam preservar IDs e versões das regras em cada lote.
