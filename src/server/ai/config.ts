import { z } from "zod";

import {
  aiProviderIdSchema,
  aiModelIdSchema,
  aiModelSelectionSchema,
  getAiModelDefinition,
  reasoningEffortSchema,
  type AiProviderId,
} from "@/domain/ai-models";

const mockProviderConfigSchema = z
  .object({
    provider: z.literal("mock"),
  })
  .strict();

export const httpProviderConfigSchema = z
  .object({
    provider: z.literal("http"),
    providerId: aiProviderIdSchema,
    baseUrl: z.url(),
    apiKey: z.string().trim().min(1),
    model: aiModelIdSchema,
    reasoningEffort: reasoningEffortSchema.optional(),
    timeoutMs: z.number().int().positive(),
  })
  .strict()
  .superRefine((config, context) => {
    const result = aiModelSelectionSchema.safeParse({
      model: config.model,
      ...(config.reasoningEffort
        ? { reasoningEffort: config.reasoningEffort }
        : {}),
    });

    if (!result.success) {
      for (const issue of result.error.issues) {
        context.addIssue({
          code: "custom",
          message: issue.message,
          path: issue.path,
        });
      }
    }

    if (getAiModelDefinition(config.model).provider !== config.providerId) {
      context.addIssue({
        code: "custom",
        message: "O modelo não pertence ao provedor configurado.",
        path: ["model"],
      });
    }
  });

const httpProviderConnectionConfigSchema = z
  .object({
    provider: z.literal("http"),
    providerId: aiProviderIdSchema,
    baseUrl: z.url(),
    apiKey: z.string().trim().min(1),
    timeoutMs: z.number().int().positive(),
  })
  .strict();

export const aiProviderConfigSchema = z.discriminatedUnion("provider", [
  mockProviderConfigSchema,
  httpProviderConnectionConfigSchema,
]);

export type AiProviderConfig = z.infer<typeof aiProviderConfigSchema>;
export type HttpProviderConfig = z.infer<typeof httpProviderConfigSchema>;
export type HttpProviderConnectionConfig = z.infer<
  typeof httpProviderConnectionConfigSchema
>;

export class AiConfigurationError extends Error {
  readonly name = "AiConfigurationError";

  constructor(
    readonly details: readonly string[],
    message = "A configuração do provedor de IA é inválida.",
  ) {
    super(message);
  }
}

function formatConfigurationIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const field = issue.path.join(".");
    return field ? `${field}: ${issue.message}` : issue.message;
  });
}

export function loadAiProviderConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  providerId: AiProviderId = "openai",
): AiProviderConfig {
  const provider = environment.AI_PROVIDER?.trim() || "mock";
  const connections = {
    openai: {
      baseUrl:
        environment.OPENAI_BASE_URL ??
        environment.AI_BASE_URL ??
        "https://api.openai.com/v1/",
      apiKey: environment.OPENAI_API_KEY ?? environment.AI_API_KEY,
    },
    gemini: {
      baseUrl:
        environment.GEMINI_BASE_URL ??
        "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: environment.GEMINI_API_KEY,
    },
    groq: {
      baseUrl:
        environment.GROQ_BASE_URL ??
        "https://api.groq.com/openai/v1/",
      apiKey: environment.GROQ_API_KEY,
    },
  } as const;
  const connection = connections[providerId];
  const apiKeyNames = {
    openai: "OPENAI_API_KEY",
    gemini: "GEMINI_API_KEY",
    groq: "GROQ_API_KEY",
  } as const;

  if (provider === "http" && !connection.apiKey?.trim()) {
    const apiKeyName = apiKeyNames[providerId];
    throw new AiConfigurationError(
      [`apiKey (${apiKeyName}): chave ausente.`],
      `Configure ${apiKeyName} no servidor para usar o provedor selecionado.`,
    );
  }

  const candidate =
    provider === "mock"
      ? { provider }
      : {
          provider,
          providerId,
          baseUrl: connection.baseUrl,
          apiKey: connection.apiKey,
          timeoutMs:
            environment.AI_TIMEOUT_MS === undefined
              ? 30_000
              : Number(environment.AI_TIMEOUT_MS),
        };
  const result = aiProviderConfigSchema.safeParse(candidate);

  if (!result.success) {
    throw new AiConfigurationError(formatConfigurationIssues(result.error));
  }

  return result.data;
}
