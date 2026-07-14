# Contrato esperado da matriz curricular em JSON

O snapshot canônico vigente está em `data/curriculum.json`. Novas fontes externas
devem ser adaptadas para esta forma sem modificar o significado curricular.

## Forma canônica interna

```json
{
  "version": "1.0",
  "themes": [
    {
      "id": "fonemas",
      "name": "Fonemas",
      "skills": [
        {
          "id": "skill-1",
          "name": "Nome da habilidade",
          "objectives": [
            {
              "id": "objective-1",
              "name": "Objetivo prioritário",
              "weeks": [
                {
                  "id": "week-1",
                  "number": 1,
                  "title": "Semana 1",
                  "lessons": [
                    {
                      "id": "lesson-1",
                      "number": 1,
                      "specificObjective": "Objetivo específico da aula",
                      "content": "Conteúdo previsto",
                      "defaultDurationMinutes": 25
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## Regras do importador

- validar IDs únicos;
- preservar ordem de temas, habilidades, objetivos, semanas e aulas;
- exigir objetivo específico e conteúdo por aula;
- não inferir dados ausentes silenciosamente;
- reportar caminho exato de erros;
- converter o arquivo externo para a forma canônica em uma fronteira única;
- manter o JSON original somente como dado de entrada, sem espalhar sua estrutura pela aplicação.

## Catálogo de temas

- a configuração inicial expõe apenas o tema `fonemas`, com rótulo “Fonemas”;
- a interface deve ler as opções do catálogo, sem codificar o tema diretamente no
  fluxo;
- cada habilidade pertence a exatamente um tema;
- se o arquivo externo não trouxer tema, o importador deve receber `themeId`
  explicitamente na configuração da importação; não deve inferi-lo silenciosamente;
- adicionar um tema não autoriza alterar habilidades, objetivos ou conteúdos
  recebidos no currículo.

## Seleções incompletas

O usuário começa pelo tema e pode seguir por habilidade ou objetivo, mas a
aplicação deve resolver ou solicitar uma aula concreta antes da geração. Enquanto
somente `fonemas` estiver habilitado, ele aparece como a única opção disponível.
