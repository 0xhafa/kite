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

## Como interpretar o currículo

- o campo `curriculum.lesson.content` pode conter uma aula ou atividades de referência já escritas;
- trate esse texto como fonte do objetivo, do conteúdo, do repertório e do nível de progressão, nunca como roteiro, modelo editorial ou sugestão de dinâmica;
- preserve os invariantes pedagógicos — habilidade, operação fonológica, fonemas ou letras-alvo, repertório já ensinado e nível de dificuldade — sem preservar a forma superficial do exemplo;
- antes de responder, identifique silenciosamente esses invariantes e separe-os de títulos, narrativas, materiais, agrupamentos, falas e sequências usados no exemplo.

## Originalidade e diversidade

- para cada posição ainda não preservada, conceba silenciosamente pelo menos três propostas substancialmente diferentes e escolha a mais original que continue pedagogicamente correta;
- não copie nem parafraseie títulos, ambientações, metáforas, falas, listas de estímulos, materiais, papéis, agrupamentos, regras, mecânicas ou sequências de etapas do exemplo curricular;
- repetir o fonema, a letra, a operação ou outro conteúdo indispensável ao objetivo não conta como cópia;
- faça cada atividade do lote diferir das demais e das atividades preservadas em pelo menos três dimensões relevantes: ação principal da criança, forma de participação, organização do espaço, canal sensorial, materiais, mecânica do desafio ou evidência de aprendizagem;
- não repita a mesma ação principal ou a mesma função pedagógica em duas posições do plano;
- evite recorrer sempre a cartões com figuras, separação em grupos, trilhas, caixas-surpresa ou personagens temáticos; use qualquer um desses recursos somente quando tiver função pedagógica clara;
- novidade nunca autoriza ampliar o conteúdo, antecipar a progressão ou acrescentar adereços sem função;
- se uma restrição tornar impossível uma proposta realmente distinta, registre a limitação em `uncertainties` em vez de disfarçar uma cópia com novas palavras.

## Restrições

- não alterar objetivo ou conteúdo;
- não declarar regras atendidas;
- não incluir fontes acadêmicas inventadas;
- não reutilizar atividade preservada ou exemplo curricular com nova roupagem;
- tornar a descrição fácil de consultar durante a aula: quando essas partes existirem, organizá-las em parágrafos curtos iniciados exatamente por `Recursos:`, `Preparação:`, `Apresentação:`, `Ações:` e `Transição e encerramento:`;
- separar cada parte aplicável da descrição com uma linha em branco (`\n\n`), sem juntar dois rótulos no mesmo parágrafo;
- omitir rótulos que não se aplicam à atividade, sem inventar recursos ou etapas apenas para completar a estrutura;
- retornar somente estrutura válida.
