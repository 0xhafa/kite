import type { AiProvider } from "@/domain/ai-provider";
import {
  type AiModelSelection,
  defaultAiModelSelection,
} from "@/domain/ai-models";
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
    return {
      output: generateMockBatch(input),
      run: {
        provider: "mock",
        model: "kite-mock-v1",
        rawUsage: {
          input_tokens: 180 + input.activityCount * 20,
          output_tokens: 120 + input.activityCount * 40,
        },
        latencyMilliseconds: 1,
      },
    };
  },
  async repair(input) {
    return {
      output: generateMockRepair(input),
      run: {
        provider: "mock",
        model: "kite-mock-v1",
        rawUsage: { input_tokens: 110, output_tokens: 70 },
        latencyMilliseconds: 1,
      },
    };
  },
  async evaluate(input) {
    return {
      output: evaluateSemanticsWithMock(input),
      run: {
        provider: "mock",
        model: "kite-mock-v1",
        rawUsage: { input_tokens: 70, output_tokens: 20 },
        latencyMilliseconds: 1,
      },
    };
  },
};

export function createAiProvider(
  selection: AiModelSelection = defaultAiModelSelection,
  config: AiProviderConfig = loadAiProviderConfig(),
): AiProvider {
  if (config.provider === "mock") {
    return mockAiProvider;
  }

  return new HttpAiProvider({ ...config, ...selection });
}
