# ADR-005 — Deploy na Vercel e persistência com Turso/libSQL

## Status

Aceita.

## Contexto

A decisão inicial previa SQLite em arquivo. Esse modo continua útil para
desenvolvimento local, mas o filesystem das funções da Vercel não será tratado
como armazenamento persistente. A POC precisa poder ser publicada sem perder
histórico nem produzir estados diferentes entre instâncias.

## Decisão

### Aplicação e deploy

- manter uma aplicação única com Next.js App Router, frontend e backend no mesmo
  repositório;
- usar TypeScript estrito, Tailwind CSS, Zod, Vitest e Playwright;
- adotar a Vercel como ambiente-alvo da POC publicada;
- manter chaves de banco e do provedor de IA somente no servidor.

### Banco e ORM

- manter Drizzle ORM;
- usar o dialeto libSQL e o cliente `@libsql/client` atrás de um adaptador de
  persistência;
- em desenvolvimento e testes, permitir libSQL em arquivo local ou em memória;
- em preview e no ambiente publicado da Vercel, usar Turso remoto;
- nunca usar o arquivo SQLite/libSQL da função Vercel como estado persistente;
- manter Neon PostgreSQL como alternativa futura, sem implementar dois dialetos
  na POC.

A inclusão de `drizzle-orm`, `@libsql/client` e `drizzle-kit` fica aprovada para a
tarefa de persistência. Versões serão escolhidas e fixadas no lockfile somente
quando essa tarefa for executada.

### Cache

Usar três camadas simples:

1. banco como cache durável das execuções de IA, com chave derivada da entrada
   normalizada, contexto e versão curricular, parâmetros, template de prompt,
   conjunto de regras, provedor e modelo;
2. cache do Next.js somente para catálogos versionados e estáticos, como temas,
   currículo publicado e regras pedagógicas ativas;
3. estado local do navegador para formulário e revisão ainda não confirmada,
   sem torná-lo fonte de verdade do histórico.

Uma resposta de IA só pode ser reutilizada depois de validada contra o schema de
saída. Reutilizações devem apontar para a execução original para preservar custo,
prompt e rastreabilidade. Redis não será adicionado nesta fase.

### Autenticação e arquivos

- não criar contas, papéis ou sistema multiusuário na POC;
- usar proteção da própria plataforma para previews privados, se necessário;
- qualquer senha compartilhada dentro do aplicativo exige uma tarefa e uma
  decisão específicas;
- gerar PDFs ou imagens sob demanda; não armazenar binários no banco;
- avaliar Vercel Blob apenas se surgir uma necessidade explícita de persistir
  arquivos gerados.

### Temas

O tema não será codificado diretamente no fluxo. Haverá um catálogo tipado de
temas e o currículo será associado por `themeId`. A configuração inicial expõe
somente `fonemas`, com o rótulo “Fonemas”, mas aceita novos temas no futuro sem
alterar os contratos centrais de geração e revisão.

## Consequências

- o desenvolvimento local continua simples e compatível com SQLite por meio de
  libSQL;
- preview e publicação exigirão URL e token do Turso configurados como segredos
  server-side;
- schema e consultas permanecem independentes da origem local ou remota;
- a chave de cache passa a fazer parte do contrato de geração;
- todas as versões de atividade precisam apontar para prompt, regras aplicadas,
  validação e execução do modelo;
- autenticação completa, Redis e armazenamento permanente de arquivos permanecem
  fora do escopo.

## Alternativas consideradas

### SQLite em arquivo na Vercel

Rejeitado como persistência porque instâncias de execução não são a fonte de
estado durável da aplicação.

### Neon PostgreSQL

É uma alternativa válida para uma evolução com necessidades relacionais maiores,
mas aumentaria agora a distância em relação ao schema SQLite/libSQL já escolhido.

## Referências

- [Drizzle com Turso/libSQL](https://orm.drizzle.team/docs/sqlite/connect-turso)
- [SDKs do Turso](https://docs.turso.tech/sdk/introduction)
- [Modelo stateless e serviços de persistência na Vercel](https://vercel.com/kb/guide/docker-on-vercel-vs-render)
