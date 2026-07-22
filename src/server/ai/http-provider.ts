import { z } from "zod";

import type {
  AiFailedAttempt,
  AiProvider,
  AiProviderResult,
  AiRunMetadata,
} from "@/domain/ai-provider";
import {
  type GenerationModelInput,
  type GenerationModelOutput,
  type RepairModelInput,
  type RepairModelOutput,
  type ValidationModelInput,
  generationModelInputSchema,
  generationModelOutputSchema,
  repairModelInputSchema,
  repairModelOutputSchema,
  validationModelInputSchema,
} from "@/domain/model-contracts";
import {
  type ValidationModelOutput,
  validationModelOutputSchema,
} from "@/domain/rules";
import { jsonObjectSchema } from "@/domain/shared";

import type { HttpProviderConfig } from "./config";
import {
  type AiMessage,
  type AiOperation,
  createGenerationMessages,
  createRepairCorrectionMessage,
  createRepairMessages,
  createValidationMessages,
} from "./prompts";

export type AiProviderErrorCode =
  | "invalid_input"
  | "http_error"
  | "network_error"
  | "timeout"
  | "invalid_response";

const errorMessages = {
  invalid_input:
    "Não foi possível enviar os dados ao provedor de IA. Revise a seleção e tente novamente.",
  http_error:
    "O provedor de IA recusou a solicitação. Tente novamente; se o erro continuar, verifique a configuração do provedor.",
  network_error:
    "Não foi possível se comunicar com o provedor de IA. Verifique a conexão e tente novamente.",
  timeout:
    "O provedor de IA demorou mais que o esperado. Tente novamente em instantes.",
  invalid_response:
    "O provedor de IA retornou uma resposta inválida. Tente novamente; se o erro continuar, verifique o modelo configurado.",
} as const satisfies Record<AiProviderErrorCode, string>;

export class AiProviderError extends Error {
  readonly name = "AiProviderError";

  constructor(
    readonly code: AiProviderErrorCode,
    readonly operation: AiOperation,
    readonly details: readonly string[] = [],
    readonly statusCode?: number,
    message: string = errorMessages[code],
    readonly attempts: readonly AiFailedAttempt[] = [],
  ) {
    super(message);
  }
}

type StructuredRequest<TInput, TOutput> = {
  operation: AiOperation;
  input: TInput;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  messages: (input: TInput) => AiMessage[];
  validateOutput?: (input: TInput, output: TOutput) => string[];
  retryInvalidResponse?: boolean;
};

type ChatCompletionEnvelope = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  usage?: unknown;
};

const MAX_STRUCTURED_REQUEST_ATTEMPTS = 2;

const supportedStrictJsonSchemaKeys = new Set([
  "type",
  "properties",
  "items",
  "required",
  "additionalProperties",
  "enum",
  "anyOf",
  "description",
]);

function sanitizeStrictJsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeStrictJsonSchema);
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(value)) {
    if (key === "properties" && typeof child === "object" && child !== null) {
      sanitized.properties = Object.fromEntries(
        Object.entries(child).map(([propertyName, propertySchema]) => [
          propertyName,
          sanitizeStrictJsonSchema(propertySchema),
        ]),
      );
      continue;
    }

    if (supportedStrictJsonSchemaKeys.has(key)) {
      sanitized[key] = sanitizeStrictJsonSchema(child);
    }
  }

  return sanitized;
}

function responseFormatFor(
  config: HttpProviderConfig,
  operation: AiOperation,
  outputSchema: z.ZodType,
) {
  if (
    config.providerId === "groq" &&
    config.model === "openai/gpt-oss-120b" &&
    operation !== "validation"
  ) {
    return {
      type: "json_schema",
      json_schema: {
        name: `kite_${operation}`,
        strict: true,
        schema: sanitizeStrictJsonSchema(z.toJSONSchema(outputSchema)),
      },
    };
  }

  return { type: "json_object" };
}

function httpErrorMessage(statusCode: number): string {
  if (statusCode === 401 || statusCode === 403) {
    return "O provedor de IA recusou a credencial configurada. Verifique a chave da API.";
  }

  if (statusCode === 429) {
    return "O provedor de IA atingiu o limite de uso. Aguarde um instante e tente novamente.";
  }

  if (statusCode >= 500) {
    return "O provedor de IA está temporariamente indisponível. Tente novamente em instantes.";
  }

  return errorMessages.http_error;
}

async function providerErrorDetails(response: Response): Promise<string[]> {
  try {
    const payload = await response.json() as {
      error?: { code?: unknown; type?: unknown };
    };
    const code = typeof payload.error?.code === "string"
      ? payload.error.code
      : undefined;
    const type = typeof payload.error?.type === "string"
      ? payload.error.type
      : undefined;

    return [
      ...(code ? [`Código do provedor: ${code}.`] : []),
      ...(type && type !== code ? [`Tipo do erro: ${type}.`] : []),
    ];
  } catch {
    return [];
  }
}

function formatSchemaIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isTransientProviderError(error: unknown): error is AiProviderError {
  return error instanceof AiProviderError && (
    error.code === "timeout" ||
    error.code === "network_error" ||
    (error.code === "http_error" && (
      error.statusCode === 408 ||
      error.statusCode === 429 ||
      (error.statusCode !== undefined && error.statusCode >= 500)
    ))
  );
}

function validateConsideredRules(
  consideredRuleIds: readonly string[],
  allowedRuleIds: ReadonlySet<string>,
): string[] {
  const unknownRuleIds = consideredRuleIds.filter(
    (ruleId) => !allowedRuleIds.has(ruleId),
  );

  return unknownRuleIds.length === 0
    ? []
    : ["A saída referencia regras que não fazem parte das regras aplicáveis."];
}

function safeAttemptError(error: AiProviderError): string {
  return [
    error.message,
    ...(error.code === "invalid_response" ? error.details : []),
    ...(error.statusCode ? [`Status HTTP ${error.statusCode}.`] : []),
  ].join(" ");
}

function validateGenerationOutput(
  input: GenerationModelInput,
  output: GenerationModelOutput,
): string[] {
  const details: string[] = [];
  const allowedRuleIds = new Set(input.applicableRules.map((rule) => rule.ruleId));

  if (output.plan.totalDurationMinutes !== input.totalDurationMinutes) {
    details.push("A duração planejada não corresponde à duração solicitada.");
  }

  if (output.activities.length !== input.activityCount) {
    details.push("A quantidade gerada não corresponde à quantidade solicitada.");
  }

  for (const activity of output.activities) {
    details.push(
      ...validateConsideredRules(activity.consideredRuleIds, allowedRuleIds),
    );
  }

  return details;
}

function validateRepairOutput(
  input: RepairModelInput,
  output: RepairModelOutput,
): string[] {
  const details: string[] = [];
  const allowedRuleIds = new Set(input.applicableRules.map((rule) => rule.ruleId));

  if (output.activity.slotIndex !== input.currentActivity.slotIndex) {
    details.push("A atividade reparada não preserva a posição original.");
  }

  if (output.activity.durationMinutes !== input.requiredDurationMinutes) {
    details.push("A atividade reparada não preserva a duração obrigatória.");
  }

  details.push(
    ...validateConsideredRules(output.activity.consideredRuleIds, allowedRuleIds),
  );

  return details;
}

function validateSemanticOutput(
  input: ValidationModelInput,
  output: ValidationModelOutput,
): string[] {
  const expectedRules = input.applicableRules.map(
    (rule) => `${rule.ruleId}:${rule.ruleVersion}`,
  );
  const returnedRules = output.results.map(
    (result) => `${result.ruleId}:${result.ruleVersion}`,
  );
  const expectedCounts = new Map<string, number>();
  const returnedCounts = new Map<string, number>();

  for (const key of expectedRules) {
    expectedCounts.set(key, (expectedCounts.get(key) ?? 0) + 1);
  }
  for (const key of returnedRules) {
    returnedCounts.set(key, (returnedCounts.get(key) ?? 0) + 1);
  }

  const hasDifferentRules =
    expectedCounts.size !== returnedCounts.size ||
    [...expectedCounts].some(
      ([key, count]) => returnedCounts.get(key) !== count,
    );
  const blockingFailures = output.results.filter(
    (result) => result.status === "failed",
  ).length;
  const details: string[] = [];

  if (hasDifferentRules) {
    details.push("A avaliação não devolveu exatamente as regras aplicáveis.");
  }

  if (output.summary.blockingFailures !== blockingFailures) {
    details.push("O total de falhas do resumo não corresponde aos resultados.");
  }

  return details;
}

export class HttpAiProvider implements AiProvider {
  constructor(
    private readonly config: HttpProviderConfig,
    private readonly fetchImplementation: typeof fetch = fetch,
    private readonly now: () => number = () => performance.now(),
  ) {}

  generate(
    input: GenerationModelInput,
  ): Promise<AiProviderResult<GenerationModelOutput>> {
    return this.requestStructured({
      operation: "generation",
      input,
      inputSchema: generationModelInputSchema,
      outputSchema: generationModelOutputSchema,
      messages: createGenerationMessages,
      validateOutput: validateGenerationOutput,
    });
  }

  repair(
    input: RepairModelInput,
  ): Promise<AiProviderResult<RepairModelOutput>> {
    return this.requestStructured({
      operation: "repair",
      input,
      inputSchema: repairModelInputSchema,
      outputSchema: repairModelOutputSchema,
      messages: createRepairMessages,
      validateOutput: validateRepairOutput,
      retryInvalidResponse: true,
    });
  }

  evaluate(
    input: ValidationModelInput,
  ): Promise<AiProviderResult<ValidationModelOutput>> {
    return this.requestStructured({
      operation: "validation",
      input,
      inputSchema: validationModelInputSchema,
      outputSchema: validationModelOutputSchema,
      messages: createValidationMessages,
      validateOutput: validateSemanticOutput,
    });
  }

  private async requestStructured<TInput, TOutput>({
    operation,
    input,
    inputSchema,
    outputSchema,
    messages,
    validateOutput,
    retryInvalidResponse = false,
  }: StructuredRequest<TInput, TOutput>): Promise<AiProviderResult<TOutput>> {
    const inputResult = inputSchema.safeParse(input);

    if (!inputResult.success) {
      throw new AiProviderError(
        "invalid_input",
        operation,
        formatSchemaIssues(inputResult.error),
      );
    }

    let renderedMessages = messages(inputResult.data);
    const failedAttempts: AiFailedAttempt[] = [];

    for (let attempt = 1; ; attempt += 1) {
      const startedAt = this.now();
      let envelope: ChatCompletionEnvelope | undefined;

      try {
        envelope = await this.requestEnvelope(
          operation,
          renderedMessages,
          outputSchema,
        );
        const output = this.parseStructuredOutput(
          operation,
          inputResult.data,
          envelope,
          outputSchema,
          validateOutput,
        );

        return {
          output,
          run: this.createRunMetadata(envelope, startedAt),
          ...(failedAttempts.length > 0 ? { failedAttempts } : {}),
        };
      } catch (error) {
        if (!(error instanceof AiProviderError)) {
          throw error;
        }

        failedAttempts.push({
          run: this.createRunMetadata(envelope, startedAt),
          error: safeAttemptError(error),
        });
        const shouldRetryInvalidResponse =
          retryInvalidResponse && error.code === "invalid_response";

        if (
          attempt < MAX_STRUCTURED_REQUEST_ATTEMPTS &&
          (isTransientProviderError(error) || shouldRetryInvalidResponse)
        ) {
          if (shouldRetryInvalidResponse) {
            renderedMessages = [
              ...messages(inputResult.data),
              createRepairCorrectionMessage(error.details),
            ];
          }
          continue;
        }

        throw new AiProviderError(
          error.code,
          error.operation,
          error.details,
          error.statusCode,
          error.message,
          failedAttempts,
        );
      }
    }
  }

  private parseStructuredOutput<TInput, TOutput>(
    operation: AiOperation,
    input: TInput,
    envelope: ChatCompletionEnvelope,
    outputSchema: z.ZodType<TOutput>,
    validateOutput?: (input: TInput, output: TOutput) => string[],
  ): TOutput {

    const content = envelope.choices?.[0]?.message?.content;

    if (typeof content !== "string" || content.trim() === "") {
      throw new AiProviderError("invalid_response", operation, [
        "A resposta não contém conteúdo estruturado.",
      ]);
    }

    let decoded: unknown;

    try {
      decoded = JSON.parse(content);
    } catch {
      throw new AiProviderError("invalid_response", operation, [
        "O conteúdo retornado não é um JSON válido.",
      ]);
    }

    const outputResult = outputSchema.safeParse(decoded);

    if (!outputResult.success) {
      throw new AiProviderError(
        "invalid_response",
        operation,
        formatSchemaIssues(outputResult.error),
      );
    }

    const contractDetails = validateOutput?.(
      input,
      outputResult.data,
    );

    if (contractDetails && contractDetails.length > 0) {
      throw new AiProviderError(
        "invalid_response",
        operation,
        contractDetails,
      );
    }

    const rawUsageResult =
      envelope.usage === undefined
        ? undefined
        : jsonObjectSchema.safeParse(envelope.usage);

    if (rawUsageResult && !rawUsageResult.success) {
      throw new AiProviderError("invalid_response", operation, [
        "O uso de tokens retornado pelo provedor não é um objeto JSON válido.",
      ]);
    }

    return outputResult.data;
  }

  private createRunMetadata(
    envelope: ChatCompletionEnvelope | undefined,
    startedAt: number,
  ): AiRunMetadata {
    const rawUsageResult = envelope?.usage === undefined
      ? undefined
      : jsonObjectSchema.safeParse(envelope.usage);

    return {
      provider: this.config.providerId,
      model: this.config.model,
      ...(this.config.reasoningEffort
        ? { reasoningEffort: this.config.reasoningEffort }
        : {}),
      ...(rawUsageResult?.success ? { rawUsage: rawUsageResult.data } : {}),
      latencyMilliseconds: Math.max(0, Math.round(this.now() - startedAt)),
    };
  }

  private async requestEnvelope(
    operation: AiOperation,
    messages: readonly AiMessage[],
    outputSchema: z.ZodType,
  ): Promise<ChatCompletionEnvelope> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await this.fetchImplementation(
        new URL("chat/completions", `${this.config.baseUrl.replace(/\/+$/u, "")}/`),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.config.model,
            messages,
            response_format: responseFormatFor(
              this.config,
              operation,
              outputSchema,
            ),
            ...(this.config.reasoningEffort
              ? { reasoning_effort: this.config.reasoningEffort }
              : {}),
            ...(this.config.providerId === "groq" &&
            this.config.reasoningEffort === "default"
              ? { reasoning_format: "hidden" }
              : {}),
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new AiProviderError(
          "http_error",
          operation,
          await providerErrorDetails(response),
          response.status,
          httpErrorMessage(response.status),
        );
      }

      try {
        return (await response.json()) as ChatCompletionEnvelope;
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          throw new AiProviderError("timeout", operation);
        }

        throw new AiProviderError("invalid_response", operation, [
          "O corpo HTTP não é um JSON válido.",
        ]);
      }
    } catch (error) {
      if (error instanceof AiProviderError) {
        throw error;
      }

      if (controller.signal.aborted || isAbortError(error)) {
        throw new AiProviderError("timeout", operation);
      }

      throw new AiProviderError("network_error", operation);
    } finally {
      clearTimeout(timeout);
    }
  }
}
