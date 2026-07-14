# ADR-001 — Stack da POC

## Status

Substituída pela [ADR-005](./ADR-005-vercel-libsql-persistence.md).

Esta ADR preserva a decisão inicial como histórico. A stack vigente está descrita
na ADR-005.

## Decisão

Usar aplicação web única com Next.js, TypeScript, Tailwind, SQLite, Drizzle, Zod, Vitest e Playwright.

## Motivos

- reduz quantidade de serviços;
- permite desenvolver UI e endpoints no mesmo repositório;
- oferece contratos tipados;
- SQLite simplifica execução local e ambientes de tarefa;
- testes cobrem domínio e fluxo principal.

## Consequências

A arquitetura deve manter adaptadores para que banco e provedor de IA possam ser substituídos posteriormente.
