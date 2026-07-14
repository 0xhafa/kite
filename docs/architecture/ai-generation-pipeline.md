# Pipeline de geração

## 1. Resolver contexto curricular

Carregar habilidade, objetivo, semana, aula, aulas anteriores e próxima aula. O contexto da progressão deve ser limitado ao necessário.

## 2. Planejar o lote

Produzir antes da redação:

- função pedagógica de cada atividade;
- verbo principal da ação da criança;
- estrutura lúdica;
- duração individual;
- regras condicionais aplicáveis;
- palavras e recursos necessários.

A soma das durações precisa corresponder ao total solicitado.

## 3. Gerar saída estruturada

O modelo retorna JSON validado contendo:

- atividades;
- justificativa curta do planejamento;
- IDs das regras consideradas;
- alertas de incerteza.

O conteúdo curricular deve vir do contexto, não ser reescrito pelo modelo.

## 4. Validação determinística

Verificar schema, duração, quantidade, campos obrigatórios, duplicações literais e referências válidas.

## 5. Validação semântica

Um avaliador separado recebe atividade, contexto e regras aplicáveis. Ele retorna status e evidência por regra.

## 6. Reparo controlado

Quando houver falha reparável, enviar somente atividade, falhas e contexto mínimo para uma nova versão. Limitar tentativas automáticas para evitar loops e custos descontrolados.

## 7. Persistência

Salvar lote, atividades, versões, regras, validações, execuções do modelo e uso de tokens.

## 8. Exibição

Apenas resultados estruturalmente válidos são exibidos. Falhas pedagógicas podem aparecer como `needs_review` se não houver confiança para reparo automático.
