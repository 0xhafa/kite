import type { z } from "zod";

import type { AiProvider } from "@/domain/ai-provider";
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

import type { HttpProviderConfig } from "./config";
import {
  type AiMessage,
  type AiOperation,
  createGenerationMessages,
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
  invalid_input: "A entrada enviada ao provedor de IA não atende ao contrato.",
  http_error: "O provedor de IA recusou a solicitação.",
  network_error: "Não foi possível se comunicar com o provedor de IA.",
  timeout: "O provedor de IA excedeu o tempo limite configurado.",
  invalid_response: "A resposta do provedor de IA não atende ao contrato.",
} as const satisfies Record<AiProviderErrorCode, string>;

export class AiProviderError extends Error {
  readonly name = "AiProviderError";

  constructor(
    readonly code: AiProviderErrorCode,
    readonly operation: AiOperation,
    readonly details: readonly string[] = [],
    readonly statusCode?: number,
  ) {
    super(errorMessages[code]);
  }
}

type StructuredRequest<TInput, TOutput> = {
  operation: AiOperation;
  input: TInput;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  messages: (input: TInput) => AiMessage[];
  validateOutput?: (input: TInput, output: TOutput) => string[];
};

type ChatCompletionEnvelope = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
};

function formatSchemaIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
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
    : [`A saída referencia regras não aplicáveis: ${[...new Set(unknownRuleIds)].join(", ")}.`];
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
  ) {}

  generate(input: GenerationModelInput): Promise<GenerationModelOutput> {
    return this.requestStructured({
      operation: "generation",
      input,
      inputSchema: generationModelInputSchema,
      outputSchema: generationModelOutputSchema,
      messages: createGenerationMessages,
      validateOutput: validateGenerationOutput,
    });
  }

  repair(input: RepairModelInput): Promise<RepairModelOutput> {
    return this.requestStructured({
      operation: "repair",
      input,
      inputSchema: repairModelInputSchema,
      outputSchema: repairModelOutputSchema,
      messages: createRepairMessages,
      validateOutput: validateRepairOutput,
    });
  }

  evaluate(input: ValidationModelInput): Promise<ValidationModelOutput> {
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
  }: StructuredRequest<TInput, TOutput>): Promise<TOutput> {
    const inputResult = inputSchema.safeParse(input);

    if (!inputResult.success) {
      throw new AiProviderError(
        "invalid_input",
        operation,
        formatSchemaIssues(inputResult.error),
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let response: Response;
    let envelope: ChatCompletionEnvelope;

    try {
      response = await this.fetchImplementation(
        new URL("chat/completions", `${this.config.baseUrl.replace(/\/+$/u, "")}/`),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: messages(inputResult.data),
            response_format: { type: "json_object" },
            temperature: 0,
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new AiProviderError("http_error", operation, [], response.status);
      }

      try {
        envelope = (await response.json()) as ChatCompletionEnvelope;
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
      inputResult.data,
      outputResult.data,
    );

    if (contractDetails && contractDetails.length > 0) {
      throw new AiProviderError(
        "invalid_response",
        operation,
        contractDetails,
      );
    }

    return outputResult.data;
  }
}
