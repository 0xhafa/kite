import type { AiProvider } from "@/domain/ai-provider";
import {
  generateMockBatch,
  generateMockRepair,
} from "@/domain/mock-generator";
import { evaluateSemanticsWithMock } from "@/domain/semantic-validator";

import {
  type AiProviderConfig,
  loadAiProviderConfig,
} from "./config";
import { HttpAiProvider } from "./http-provider";

export const mockAiProvider: AiProvider = {
  async generate(input) {
    return generateMockBatch(input);
  },
  async repair(input) {
    return generateMockRepair(input);
  },
  async evaluate(input) {
    return evaluateSemanticsWithMock(input);
  },
};

export function createAiProvider(
  config: AiProviderConfig = loadAiProviderConfig(),
): AiProvider {
  if (config.provider === "mock") {
    return mockAiProvider;
  }

  return new HttpAiProvider(config);
}
