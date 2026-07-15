import { describe, expect, it } from "vitest";

import { shouldUseDurableGenerationWorkflow } from "./workflow-dispatch";

describe("despacho durável de geração", () => {
  it("ativa workflows automaticamente na Vercel", () => {
    expect(shouldUseDurableGenerationWorkflow({ VERCEL: "1" })).toBe(true);
  });

  it("permite ativação explícita fora da Vercel", () => {
    expect(shouldUseDurableGenerationWorkflow({ KITE_ASYNC_GENERATION: "1" })).toBe(true);
  });

  it("mantém o fluxo síncrono nos testes locais por padrão", () => {
    expect(shouldUseDurableGenerationWorkflow({})).toBe(false);
  });
});
