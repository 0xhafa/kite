import type { AiProvider } from "@/domain/ai-provider";
import {
  aiModelSelectionSchema,
  type AiModelSelection,
  defaultAiModelSelection,
  getAiModelDefinition,
} from "@/domain/ai-models";
import {
  generateMockBatch,
  generateMockRepair,
} from "@/domain/mock-generator";
import { evaluateSemanticsWithMock } from "@/domain/semantic-validator";

import {
  type AiProviderConfig,
  AiConfigurationError,
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
  config?: AiProviderConfig,
): AiProvider {
  const parsedSelection = aiModelSelectionSchema.parse(selection);
  const modelProvider = getAiModelDefinition(parsedSelection.model).provider;
  const resolvedConfig = config ?? loadAiProviderConfig(process.env, modelProvider);

  if (resolvedConfig.provider === "mock") {
    return mockAiProvider;
  }

  if (resolvedConfig.providerId !== modelProvider) {
    throw new AiConfigurationError([
      `O modelo ${parsedSelection.model} pertence ao provedor ${modelProvider}, não a ${resolvedConfig.providerId}.`,
    ]);
  }

  return new HttpAiProvider({ ...resolvedConfig, ...parsedSelection });
}
