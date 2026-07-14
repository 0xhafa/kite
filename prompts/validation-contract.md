# Contrato do avaliador

O avaliador é separado do gerador e recebe apenas o necessário para julgar uma atividade.

## Entrada

- currículo da aula;
- atividade;
- atividades relacionadas do lote;
- regras aplicáveis e rubricas;
- progressão relevante.

## Saída

```json
{
  "results": [
    {
      "ruleId": "PED-001",
      "ruleVersion": 1,
      "status": "passed",
      "evidence": "trecho exato da atividade",
      "explanation": "explicação curta",
      "confidence": 0.91
    }
  ],
  "summary": {
    "blockingFailures": 0,
    "needsHumanReview": 1
  }
}
```

## Regras do avaliador

- não inventar evidência;
- usar `not_applicable` quando a condição não se aplica;
- usar `needs_review` para julgamentos incertos;
- detectar repetição comparando a ação da criança com as atividades relacionadas;
- não reescrever a atividade nesta etapa.
