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
- tornar a descrição fácil de consultar durante a aula: quando essas partes existirem, organizá-las em parágrafos curtos iniciados exatamente por `Recursos:`, `Preparação:`, `Apresentação:`, `Ações:` e `Transição e encerramento:`;
- separar cada parte aplicável da descrição com uma linha em branco (`\n\n`), sem juntar dois rótulos no mesmo parágrafo;
- omitir rótulos que não se aplicam à atividade, sem inventar recursos ou etapas apenas para completar a estrutura;
- retornar somente estrutura válida.
