# Arquitetura técnica da POC

## Decisão para a POC

Aplicação web única em TypeScript, com frontend e backend no mesmo repositório.

### Stack aprovada

- Next.js com App Router;
- TypeScript estrito;
- Tailwind CSS e componentes acessíveis sem identidade visual copiada;
- Vercel como ambiente-alvo da POC publicada;
- Drizzle ORM com dialeto libSQL para schema e consultas;
- libSQL em arquivo ou memória para desenvolvimento e testes;
- Turso como banco remoto para preview e publicação na Vercel;
- Zod para validação dos contratos;
- Vitest para testes unitários;
- Playwright para fluxo crítico de interface;
- adaptador server-side para o provedor de IA.

Não fixar versões neste documento. O bootstrap deve selecionar versões estáveis e registrar o lockfile.

O filesystem das funções Vercel não é fonte de persistência. Nenhuma execução
publicada pode depender de um arquivo SQLite/libSQL local para manter histórico.

| Ambiente | Persistência | Finalidade |
| --- | --- | --- |
| teste unitário | libSQL em memória | isolamento e velocidade |
| desenvolvimento local | libSQL em arquivo ignorado pelo Git | execução sem serviço externo |
| preview e POC publicada | Turso remoto | estado durável entre instâncias e deploys |

## Camadas

### Domínio

Tipos e invariantes sem dependência de UI ou provedor:

- currículo;
- catálogo de temas;
- lote e atividade;
- regras e aplicabilidade;
- validação;
- feedback;
- uso de tokens.

### Aplicação

Casos de uso:

- carregar currículo;
- listar temas habilitados e resolver o `themeId` selecionado;
- resolver contexto de aula;
- planejar lote;
- gerar;
- validar;
- aprovar/rejeitar;
- regenerar;
- promover feedback após confirmação.

### Infraestrutura

- adaptador Drizzle/libSQL com configuração local ou Turso;
- adaptador de IA;
- importador de JSON;
- relógio e identificadores;
- observabilidade de uso.

### Interface

- seleção de tema, inicialmente apenas “Fonemas”;
- seleção curricular;
- configuração;
- revisão;
- relatório de validação;
- histórico.

## Persistência e rastreabilidade

O banco é a fonte de verdade para lotes, versões de atividades, decisões de
revisão, relatórios de validação e uso de tokens. Cada versão de atividade deve
ser ligada a:

- contexto e versão curricular imutáveis;
- parâmetros normalizados da solicitação;
- template, versão e conteúdo renderizado do prompt;
- execução do modelo e resposta validada;
- IDs e versões das regras aplicadas;
- evidências e resultados de validação;
- decisão e feedback humano, quando existirem.

Guardar uma regra no prompt não prova que ela foi atendida. O resultado de
validação continua obrigatório para toda atividade exibida.

## Estratégia de cache

### 1. Cache durável de gerações

Antes de chamar a IA, calcular uma chave determinística contendo, no mínimo:

- `themeId`, aula e versão curricular;
- entrada e parâmetros normalizados;
- versão do template de prompt;
- versão do conjunto de regras;
- provedor e modelo.

Se houver uma execução concluída, validada e compatível, reutilizar sua resposta
sem nova chamada ao modelo e registrar a relação com a execução original. Erros,
respostas incompletas ou payloads que falharam no schema nunca entram no cache.

### 2. Cache de dados estáticos do Next.js

Aplicar somente a catálogos versionados, como temas, currículo publicado e regras
ativas. A chave ou tag deve incluir a versão do dado para permitir invalidação
explícita.

### 3. Estado local do navegador

Manter formulário, seleção e edições ainda não confirmadas para melhorar a
experiência. Esse estado não substitui o histórico persistido e pode ser
descartado sem corromper atividades aprovadas.

Redis não faz parte da POC.

## Arquivos e autenticação

- não armazenar PDFs, imagens ou outros binários no banco;
- gerar arquivos sob demanda;
- usar Vercel Blob somente após necessidade explícita e nova decisão;
- não implementar contas ou múltiplos usuários;
- preferir proteção de preview da plataforma quando o acesso precisar ser
  restrito;
- qualquer senha compartilhada no aplicativo depende de tarefa explícita.

## Estratégia de desenvolvimento

Implementar primeiro com um gerador mock determinístico. Integrar o provedor real apenas quando contratos, UI e persistência estiverem testados.

A persistência deve ser implementada primeiro com o adaptador libSQL local e
verificada também contra Turso antes de considerar a POC pronta para publicação.
