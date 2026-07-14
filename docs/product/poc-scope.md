# Escopo da POC

## Incluído

- carregar matriz curricular de um JSON local;
- selecionar um tema de um catálogo tipado, inicialmente apenas “Fonemas”;
- navegar por habilidade, objetivo, semana e aula;
- exibir objetivo específico e conteúdo da aula;
- configurar duração total, com padrão de 25 minutos;
- configurar quantidade de atividades;
- gerar um lote de atividades;
- atribuir duração individual a cada atividade;
- validar automaticamente as atividades antes da exibição;
- aprovar ou rejeitar cada atividade;
- aceitar feedback opcional na rejeição;
- regenerar somente a atividade rejeitada;
- preservar duração individual e total durante a regeneração;
- mostrar relatório de critérios e evidências;
- mostrar uso de tokens por lote e por etapa;
- manter histórico persistente de lotes, versões e feedbacks;
- evitar nova chamada à IA quando uma geração validada e exatamente compatível já
  existir no cache durável.

## Fora da POC

- contas, autenticação completa e múltiplos usuários;
- colaboração em tempo real;
- cobrança e limites comerciais;
- geração automática das ilustrações ou da folha diagramada;
- exportação avançada para PDF, DOCX ou sistemas escolares;
- armazenamento permanente de PDFs e imagens gerados;
- Redis ou outra camada dedicada de cache;
- promoção automática de feedback para regra global;
- painel administrativo completo de fontes acadêmicas;
- implantação produtiva com escalabilidade e alta disponibilidade.

## Definição de sucesso

Uma pessoa consegue selecionar uma aula real da matriz, gerar um grupo de atividades, entender por que cada atividade passou ou falhou nos critérios, rejeitar uma delas e receber apenas sua substituta sem alterar as demais.
