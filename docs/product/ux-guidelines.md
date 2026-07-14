# Diretrizes de UX da POC

A interface deve transmitir uma sensação lúdica, acolhedora e simples, inspirada em produtos educacionais como o Duolingo, sem copiar identidade visual, mascote, ilustrações, paleta, tipografia ou componentes proprietários.

## Princípios

- uma decisão principal por tela;
- cartões grandes e arredondados;
- hierarquia visual forte e pouco texto simultâneo;
- progresso claro entre seleção, geração e revisão;
- feedback imediato para aprovação e rejeição;
- linguagem amigável, sem perder precisão pedagógica;
- ações e estados autoexplicativos, com rótulos claros e ajuda no próprio contexto;
- tooltips somente como apoio complementar, ocultos por padrão e acessíveis sob demanda por foco
  ou ponteiro; nenhuma ação deve depender deles para ser compreendida;
- cores próprias do projeto e contraste acessível;
- animações pequenas e opcionais, nunca necessárias para entender o estado.

## Telas da POC

### 1. Início

Caminho visual pelas habilidades e objetivos, com estados disponível, selecionado e concluído.

### 2. Seleção da aula

Semana e aulas em uma trilha simples. Ao selecionar, mostrar objetivo específico e conteúdo.

### 3. Configuração

Controles grandes para duração e quantidade. Padrão de 25 minutos, com opções rápidas e campo personalizado.

### 4. Geração

Estado curto de processamento, indicando as fases: planejamento, geração e validação.

### 5. Revisão

Cartão principal com:

- título;
- duração;
- descrição;
- status geral da validação;
- botões Aprovar, Rejeitar e Detalhes.

### 6. Relatório

Painel lateral ou modal com critérios, resultados, evidências e fontes.

### 7. Resumo do lote

Atividades aprovadas, pendentes ou rejeitadas, duração total e tokens consumidos.

## Interações de revisão

A experiência pode lembrar uma pilha de cartões, mas os botões explícitos devem ser o mecanismo principal. Gestos de arrastar podem ser adicionados depois e não devem substituir acessibilidade por teclado.
