import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { batchTokenUsageSchema } from "@/domain/usage";

import { BatchUsageSummary } from "./batch-usage-summary";

describe("resumo de consumo do lote", () => {
  it("mostra total, etapas observáveis e número de chamadas", () => {
    const usage = batchTokenUsageSchema.parse({
      batchId: "lote-1",
      byStage: { plan: 0, generate: 650, validate: 420, repair: 90 },
      totalTokens: 1160,
      callCount: 5,
    });
    const html = renderToStaticMarkup(createElement(BatchUsageSummary, { usage }));

    expect(html).toContain("Consumo de tokens do lote");
    expect(html).toContain("Lote <span class=\"text-ink\">lote-1</span>");
    expect(html).toContain("Total");
    expect(html).toContain("1.160");
    expect(html).toContain("Geração");
    expect(html).toContain("650");
    expect(html).toContain("Validação");
    expect(html).toContain("420");
    expect(html).toContain("Reparos");
    expect(html).toContain("90");
    expect(html).toContain("Chamadas");
    expect(html).toContain("5");
  });

  it("explicita o estado sem registros", () => {
    const html = renderToStaticMarkup(
      createElement(BatchUsageSummary, { usage: null }),
    );

    expect(html).toContain("role=\"status\"");
    expect(html).toContain("Nenhum consumo de tokens foi registrado para este lote.");
  });
});
