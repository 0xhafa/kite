import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { batchTokenUsageSchema } from "@/domain/usage";

import { BatchUsageSummary } from "./batch-usage-summary";

describe("resumo de consumo do lote", () => {
  it("esconde consumo e custo em um tooltip acionado por um medidor acessível", () => {
    const usage = batchTokenUsageSchema.parse({
      batchId: "lote-1",
      byStage: { plan: 0, generate: 650, validate: 420, repair: 90 },
      totalTokens: 1160,
      callCount: 5,
      estimatedCostUsd: 0.01234,
      pricingVersion: "multi-provider-standard-2026-07-14",
    });
    const html = renderToStaticMarkup(createElement(BatchUsageSummary, { usage }));

    expect(html).toContain('aria-label="Consumo de tokens do lote"');
    expect(html).toContain("Total de tokens");
    expect(html).toContain("1.160");
    expect(html).toContain("Consumo e custo do lote");
    expect(html).toContain("role=\"tooltip\"");
    expect(html).toContain("invisible opacity-0");
    expect(html).toContain("aria-label=\"Ver consumo e custo estimado do lote\"");
    expect(html).toContain("aria-expanded=\"false\"");
    expect(html).toContain("Custo estimado");
    expect(html).toContain("US$");
    const describedDetailsId = html.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(describedDetailsId).toBeTruthy();
    expect(html).toContain(`id="${describedDetailsId}"`);
  });

  it("preserva lote, etapas e chamadas dentro dos detalhes técnicos", () => {
    const usage = batchTokenUsageSchema.parse({
      batchId: "lote-1",
      byStage: { plan: 0, generate: 650, validate: 420, repair: 90 },
      totalTokens: 1160,
      callCount: 5,
      estimatedCostUsd: 0.01234,
      pricingVersion: "multi-provider-standard-2026-07-14",
    });
    const html = renderToStaticMarkup(createElement(BatchUsageSummary, { usage }));

    expect(html).toContain("Identificador do lote");
    expect(html).toContain("lote-1");
    expect(html).toContain("Geração");
    expect(html).toContain("650");
    expect(html).toContain("Validação");
    expect(html).toContain("420");
    expect(html).toContain("Reparos");
    expect(html).toContain("90");
    expect(html).toContain("Chamadas");
    expect(html).toContain("5");
  });

  it("mantém o estado sem registros dentro do mesmo tooltip compacto", () => {
    const html = renderToStaticMarkup(
      createElement(BatchUsageSummary, { usage: null }),
    );

    expect(html).toContain("role=\"tooltip\"");
    expect(html).toContain("Nenhum consumo de tokens foi registrado para este lote.");
  });
});
