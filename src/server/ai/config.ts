import { z } from "zod";

const mockProviderConfigSchema = z
  .object({
    provider: z.literal("mock"),
  })
  .strict();

const httpProviderConfigSchema = z
  .object({
    provider: z.literal("http"),
    baseUrl: z.url(),
    apiKey: z.string().trim().min(1),
    model: z.string().trim().min(1),
    timeoutMs: z.number().int().positive(),
  })
  .strict();

export const aiProviderConfigSchema = z.discriminatedUnion("provider", [
  mockProviderConfigSchema,
  httpProviderConfigSchema,
]);

export type AiProviderConfig = z.infer<typeof aiProviderConfigSchema>;
export type HttpProviderConfig = z.infer<typeof httpProviderConfigSchema>;

export class AiConfigurationError extends Error {
  readonly name = "AiConfigurationError";

  constructor(readonly details: readonly string[]) {
    super("A configuração do provedor de IA é inválida.");
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
): AiProviderConfig {
  const provider = environment.AI_PROVIDER?.trim() || "mock";
  const candidate =
    provider === "mock"
      ? { provider }
      : {
          provider,
          baseUrl: environment.AI_BASE_URL,
          apiKey: environment.AI_API_KEY,
          model: environment.AI_MODEL,
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
