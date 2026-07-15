import { describe, expect, it } from "vitest";

import {
  getExpectedGenerationDurationMilliseconds,
  getGenerationStepDelayMilliseconds,
} from "./generation-progress";

describe("ritmo visual da geração", () => {
  it("usa uma espera maior para modelos com maior expectativa de duração", () => {
    expect(getExpectedGenerationDurationMilliseconds("gpt-5.6-sol", "medium")).toBeGreaterThan(
      getExpectedGenerationDurationMilliseconds("gemini-3.5-flash", "medium"),
    );
    expect(getExpectedGenerationDurationMilliseconds("gemini-3.5-flash", "medium")).toBeGreaterThan(
      getExpectedGenerationDurationMilliseconds("openai/gpt-oss-20b", "medium"),
    );
  });

  it("considera o esforço de raciocínio selecionado", () => {
    expect(getExpectedGenerationDurationMilliseconds("gpt-5.6-terra", "high")).toBeGreaterThan(
      getExpectedGenerationDurationMilliseconds("gpt-5.6-terra", "low"),
    );
  });

  it("mantém a mensagem de geração por mais tempo que as demais etapas", () => {
    const generationDelay = getGenerationStepDelayMilliseconds(
      "gpt-5.6-sol",
      "medium",
      2,
    );

    expect(generationDelay).toBeGreaterThan(
      getGenerationStepDelayMilliseconds("gpt-5.6-sol", "medium", 0),
    );
    expect(generationDelay).toBeGreaterThan(
      getGenerationStepDelayMilliseconds("gpt-5.6-sol", "medium", 3),
    );
  });
});
