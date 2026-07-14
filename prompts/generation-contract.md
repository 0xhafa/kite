# Contrato do gerador

## Entradas mínimas

- contexto curricular imutável;
- contexto de progressão relevante;
- duração total e quantidade;
- regras aplicáveis;
- atividades preservadas do mesmo lote;
- feedback local aplicável;
- versão do template editorial.

## Saída esperada

```json
{
  "plan": {
    "totalDurationMinutes": 25,
    "activities": [
      {
        "slotIndex": 0,
        "durationMinutes": 12,
        "primaryChildAction": "...",
        "pedagogicalFunction": "..."
      }
    ]
  },
  "activities": [
    {
      "slotIndex": 0,
      "title": "...",
      "description": "...",
      "durationMinutes": 12,
      "consideredRuleIds": ["PED-001"]
    }
  ],
  "uncertainties": []
}
```

## Restrições

- não alterar objetivo ou conteúdo;
- não declarar regras atendidas;
- não incluir fontes acadêmicas inventadas;
- não reutilizar atividade preservada com nova roupagem;
- retornar somente estrutura válida.
