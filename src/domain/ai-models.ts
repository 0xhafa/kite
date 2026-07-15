import { z } from "zod";

export const AI_MODEL_PRICING_VERSION = "multi-provider-standard-2026-07-15-v3";

export const AI_PROVIDER_IDS = ["openai", "gemini", "groq"] as const;

export const aiProviderIdSchema = z.enum(AI_PROVIDER_IDS);

export type AiProviderId = z.infer<typeof aiProviderIdSchema>;

type AiProviderDefinition = {
  id: AiProviderId;
  label: string;
};

export const AI_PROVIDERS = [
  { id: "openai", label: "OpenAI" },
  { id: "gemini", label: "Google Gemini" },
  { id: "groq", label: "Groq" },
] as const satisfies readonly AiProviderDefinition[];

export const AI_REASONING_EFFORTS = [
  "none",
  "minimal",
  "default",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

const GPT_56_REASONING_EFFORTS = [
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

export const AI_MODEL_IDS = [
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  "gpt-5.4-mini",
  "gpt-4.1-mini",
  "gemini-3.5-flash",
  "openai/gpt-oss-120b",
] as const;

export const aiModelIdSchema = z.enum(AI_MODEL_IDS);
export const reasoningEffortSchema = z.enum(AI_REASONING_EFFORTS);

export type AiModelId = z.infer<typeof aiModelIdSchema>;
export type ReasoningEffort = z.infer<typeof reasoningEffortSchema>;

type AiModelDefinition = {
  id: AiModelId;
  provider: AiProviderId;
  label: string;
  description: string;
  reasoningEfforts: readonly ReasoningEffort[];
  defaultReasoningEffort?: ReasoningEffort;
  pricingPerMillionTokensUsd: {
    input: number;
    output: number;
  };
  freeTier?: {
    description: string;
  };
};

export const AI_MODELS = [
  {
    id: "gpt-5.6-sol",
    provider: "openai",
    label: "GPT-5.6 Sol",
    description: "Maior capacidade para comparar a qualidade máxima.",
    reasoningEfforts: GPT_56_REASONING_EFFORTS,
    defaultReasoningEffort: "medium",
    pricingPerMillionTokensUsd: { input: 5, output: 30 },
  },
  {
    id: "gpt-5.6-terra",
    provider: "openai",
    label: "GPT-5.6 Terra",
    description: "Equilíbrio entre qualidade e custo.",
    reasoningEfforts: GPT_56_REASONING_EFFORTS,
    defaultReasoningEffort: "medium",
    pricingPerMillionTokensUsd: { input: 2.5, output: 15 },
  },
  {
    id: "gpt-5.6-luna",
    provider: "openai",
    label: "GPT-5.6 Luna",
    description: "Opção da família 5.6 otimizada para menor custo.",
    reasoningEfforts: GPT_56_REASONING_EFFORTS,
    defaultReasoningEffort: "medium",
    pricingPerMillionTokensUsd: { input: 1, output: 6 },
  },
  {
    id: "gpt-5.4-mini",
    provider: "openai",
    label: "GPT-5.4 mini",
    description: "Modelo anterior, econômico e com raciocínio configurável.",
    reasoningEfforts: ["none", "low", "medium", "high", "xhigh"],
    defaultReasoningEffort: "none",
    pricingPerMillionTokensUsd: { input: 0.75, output: 4.5 },
  },
  {
    id: "gpt-4.1-mini",
    provider: "openai",
    label: "GPT-4.1 mini",
    description: "Referência econômica sem controle de esforço de raciocínio.",
    reasoningEfforts: [],
    pricingPerMillionTokensUsd: { input: 0.4, output: 1.6 },
  },
  {
    id: "gemini-3.5-flash",
    provider: "gemini",
    label: "Gemini 3.5 Flash",
    description: "Alternativa rápida com raciocínio e saída estruturada.",
    reasoningEfforts: ["minimal", "low", "medium", "high"],
    defaultReasoningEffort: "medium",
    pricingPerMillionTokensUsd: { input: 1.5, output: 9 },
    freeTier: {
      description: "Gratuito dentro da cota do Gemini API.",
    },
  },
  {
    id: "openai/gpt-oss-120b",
    provider: "groq",
    label: "GPT-OSS 120B",
    description: "Modelo de maior capacidade da Groq com saída JSON estritamente estruturada.",
    reasoningEfforts: ["low", "medium", "high"],
    defaultReasoningEffort: "medium",
    pricingPerMillionTokensUsd: { input: 0.15, output: 0.6 },
    freeTier: {
      description: "Gratuito dentro da cota do plano Free da Groq.",
    },
  },
] as const satisfies readonly AiModelDefinition[];

const aiProvidersById = new Map<AiProviderId, AiProviderDefinition>(
  AI_PROVIDERS.map((provider) => [provider.id, provider]),
);

const aiModelsById = new Map<AiModelId, AiModelDefinition>(
  AI_MODELS.map((model) => [model.id, model]),
);

export function getAiModelDefinition(modelId: AiModelId): AiModelDefinition {
  return aiModelsById.get(modelId)!;
}

export function getAiProviderDefinition(providerId: AiProviderId): AiProviderDefinition {
  return aiProvidersById.get(providerId)!;
}

export function getAiModelsForProvider(
  providerId: AiProviderId,
): readonly AiModelDefinition[] {
  return AI_MODELS.filter((model) => model.provider === providerId);
}

export function getDefaultAiModelForProvider(providerId: AiProviderId): AiModelDefinition {
  return getAiModelsForProvider(providerId)[0]!;
}

export function getDefaultReasoningEffort(
  modelId: AiModelId,
): ReasoningEffort | undefined {
  return getAiModelDefinition(modelId).defaultReasoningEffort;
}

export const aiModelSelectionSchema = z
  .object({
    model: aiModelIdSchema,
    reasoningEffort: reasoningEffortSchema.optional(),
  })
  .strict()
  .superRefine((selection, context) => {
    const supportedEfforts = getAiModelDefinition(selection.model).reasoningEfforts;

    if (supportedEfforts.length > 0 && selection.reasoningEffort === undefined) {
      context.addIssue({
        code: "custom",
        message: "Selecione o esforço de raciocínio para este modelo.",
        path: ["reasoningEffort"],
      });
    }

    if (
      selection.reasoningEffort !== undefined &&
      !supportedEfforts.includes(selection.reasoningEffort)
    ) {
      context.addIssue({
        code: "custom",
        message: "O esforço selecionado não é compatível com este modelo.",
        path: ["reasoningEffort"],
      });
    }
  });

export const defaultAiModelSelection = aiModelSelectionSchema.parse({
  model: "gpt-5.6-sol",
  reasoningEffort: "medium",
});

export function estimateAiUsageCostUsd(input: {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  otherTokens: number;
}): number | undefined {
  if (input.provider === "mock") return 0;

  const modelResult = aiModelIdSchema.safeParse(input.model);
  if (!modelResult.success) return undefined;

  const pricing = getAiModelDefinition(modelResult.data).pricingPerMillionTokensUsd;
  const outputTokens = input.outputTokens + input.otherTokens;

  return (
    input.inputTokens * pricing.input + outputTokens * pricing.output
  ) / 1_000_000;
}

export type AiModelSelection = z.infer<typeof aiModelSelectionSchema>;
