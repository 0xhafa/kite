import { describe, expect, it, vi } from "vitest";

import type { Activity } from "@/domain/generation";
import type {
  GenerationModelInput,
  RepairModelInput,
  ValidationModelInput,
} from "@/domain/model-contracts";

import {
  AiConfigurationError,
  type HttpProviderConfig,
  loadAiProviderConfig,
} from "./config";
import { AiProviderError, HttpAiProvider } from "./http-provider";
import { createAiProvider, mockAiProvider } from "./provider";

const httpConfig: HttpProviderConfig = {
  provider: "http",
  baseUrl: "https://ia.example.test/v1/",
  apiKey: "segredo-do-servidor",
  model: "modelo-configurado-no-teste",
  timeoutMs: 100,
};

const currentActivity: Activity = {
  id: "activity-1-v1",
  batchId: "batch-1",
  logicalActivityId: "activity-1",
  slotIndex: 0,
  title: "Ouvidos atentos",
  description: "A criança escuta palavras e identifica o som inicial /f/.",
  durationMinutes: 5,
  status: "rejected",
  version: 1,
  generationRunId: "run-1",
};

const relatedActivity: Activity = {
  ...currentActivity,
  id: "activity-2-v1",
  logicalActivityId: "activity-2",
  slotIndex: 1,
  title: "Aponte a pista",
  description: "A criança aponta a figura que começa com /f/.",
  status: "approved",
};

function createGenerationInput(
  overrides: Partial<GenerationModelInput> = {},
): GenerationModelInput {
  return {
    curriculum: {
      themeId: "fonemas",
      curriculumVersion: "fixture-1.0",
      skillId: "habilidade-1",
      objectiveId: "objetivo-1",
      objectiveName: "Consciência fonológica",
      weekId: "semana-1",
      lesson: {
        id: "aula-1",
        number: 1,
        specificObjective: "Identificar o som inicial das palavras",
        content: "som inicial /f/",
      },
    },
    progressionContext: ["A turma já comparou sons do ambiente."],
    totalDurationMinutes: 5,
    activityCount: 1,
    applicableRules: [
      {
        ruleId: "PED-001",
        ruleVersion: 1,
        applicabilityReason: "A ação da criança deve estar explícita.",
        generationInstruction: "Usar um verbo observável.",
        validationCriterion: "A descrição explicita uma ação observável.",
      },
    ],
    preservedActivities: [],
    localFeedback: [],
    editorialTemplateVersion: "generation-1",
    ...overrides,
  };
}

function createRepairInput(): RepairModelInput {
  const generationInput = createGenerationInput();

  return {
    currentActivity,
    requiredDurationMinutes: currentActivity.durationMinutes,
    validationFailures: [
      {
        ruleId: "PED-001",
        ruleVersion: 1,
        status: "failed",
        explanation: "A ação da criança não está explícita.",
        confidence: 0.9,
      },
    ],
    feedback: "Explicitar uma ação observável.",
    preservedActivities: [relatedActivity],
    curriculum: generationInput.curriculum,
    applicableRules: generationInput.applicableRules,
  };
}

function createValidationInput(): ValidationModelInput {
  const generationInput = createGenerationInput();

  return {
    curriculum: generationInput.curriculum,
    activity: currentActivity,
    relatedActivities: [relatedActivity],
    applicableRules: generationInput.applicableRules,
    progressionContext: generationInput.progressionContext,
  };
}

const generationOutput = {
  plan: {
    totalDurationMinutes: 5,
    activities: [
      {
        slotIndex: 0,
        durationMinutes: 5,
        primaryChildAction: "Apontar",
        pedagogicalFunction: "Relacionar som e imagem",
      },
    ],
  },
  activities: [
    {
      slotIndex: 0,
      title: "Aponte a pista",
      description: "A criança aponta a figura que começa com /f/.",
      durationMinutes: 5,
      consideredRuleIds: ["PED-001"],
    },
  ],
  uncertainties: [],
};

function completionResponse(content: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(content) } }],
    }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

describe("configuração do provedor de IA", () => {
  it("usa o mock quando o ambiente não seleciona um provedor", () => {
    expect(loadAiProviderConfig({})).toEqual({ provider: "mock" });
  });

  it("carrega endpoint, segredo, modelo e timeout somente do ambiente do servidor", () => {
    expect(
      loadAiProviderConfig({
        AI_PROVIDER: "http",
        AI_BASE_URL: "https://ia.example.test/v1",
        AI_API_KEY: "chave-servidor",
        AI_MODEL: "modelo-ambiente",
        AI_TIMEOUT_MS: "2500",
        NEXT_PUBLIC_AI_API_KEY: "nao-deve-ser-lida",
      }),
    ).toEqual({
      provider: "http",
      baseUrl: "https://ia.example.test/v1",
      apiKey: "chave-servidor",
      model: "modelo-ambiente",
      timeoutMs: 2500,
    });
  });

  it("falha com erro tipado quando falta segredo no modo HTTP", () => {
    expect(() =>
      loadAiProviderConfig({
        AI_PROVIDER: "http",
        AI_BASE_URL: "https://ia.example.test/v1",
        AI_MODEL: "modelo-ambiente",
      }),
    ).toThrowError(AiConfigurationError);

    try {
      loadAiProviderConfig({
        AI_PROVIDER: "http",
        AI_BASE_URL: "https://ia.example.test/v1",
        AI_MODEL: "modelo-ambiente",
      });
      throw new Error("A configuração incompleta deveria falhar.");
    } catch (error) {
      expect(error).toMatchObject({
        details: expect.arrayContaining([expect.stringContaining("apiKey")]),
      });
      expect((error as Error).message).not.toContain("chave-servidor");
    }
  });
});

describe("seleção do provedor", () => {
  it("mantém o mock disponível por uma fronteira assíncrona", async () => {
    const provider = createAiProvider({ provider: "mock" });
    const output = await provider.generate(createGenerationInput());

    expect(provider).toBe(mockAiProvider);
    expect(output.plan.totalDurationMinutes).toBe(5);
    expect(output.activities).toHaveLength(1);
  });

  it("cria o adaptador HTTP quando ele é selecionado", () => {
    expect(createAiProvider(httpConfig)).toBeInstanceOf(HttpAiProvider);
  });
});

describe("adaptador HTTP estruturado", () => {
  it("envia o modelo configurado e valida a saída de geração com Zod", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      completionResponse(generationOutput),
    );
    const provider = new HttpAiProvider(httpConfig, fetchImplementation);

    await expect(provider.generate(createGenerationInput())).resolves.toEqual(
      generationOutput,
    );

    const [url, request] = fetchImplementation.mock.calls[0];
    const body = JSON.parse(String(request?.body)) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
      response_format: { type: string };
    };

    expect(String(url)).toBe("https://ia.example.test/v1/chat/completions");
    expect(request?.headers).toMatchObject({
      Authorization: "Bearer segredo-do-servidor",
    });
    expect(body.model).toBe("modelo-configurado-no-teste");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0].content).toContain("# Contrato do gerador");
    expect(body.messages[1].content).toBe(
      JSON.stringify(createGenerationInput()),
    );
  });

  it("valida saídas estruturadas de reparo e avaliação", async () => {
    const repairOutput = {
      activity: generationOutput.activities[0],
      uncertainties: [],
    };
    const validationOutput = {
      results: [
        {
          ruleId: "PED-001",
          ruleVersion: 1,
          status: "passed",
          evidence: currentActivity.description,
          explanation: "A ação observável está explícita.",
          confidence: 0.95,
        },
      ],
      summary: { blockingFailures: 0, needsHumanReview: 0 },
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(completionResponse(repairOutput))
      .mockResolvedValueOnce(completionResponse(validationOutput));
    const provider = new HttpAiProvider(httpConfig, fetchImplementation);

    await expect(provider.repair(createRepairInput())).resolves.toEqual(
      repairOutput,
    );
    await expect(provider.evaluate(createValidationInput())).resolves.toEqual(
      validationOutput,
    );
  });

  it("rejeita a entrada antes da rede quando ela não atende ao contrato", async () => {
    const fetchImplementation = vi.fn<typeof fetch>();
    const provider = new HttpAiProvider(httpConfig, fetchImplementation);
    const input = createGenerationInput({
      progressionContext: [""],
    });

    await expect(provider.generate(input)).rejects.toMatchObject({
      name: "AiProviderError",
      code: "invalid_input",
      operation: "generation",
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("rejeita JSON do modelo que não passa pelo schema de saída", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      completionResponse({ activities: [] }),
    );
    const provider = new HttpAiProvider(httpConfig, fetchImplementation);

    await expect(provider.generate(createGenerationInput())).rejects.toMatchObject({
      name: "AiProviderError",
      code: "invalid_response",
      operation: "generation",
      details: expect.arrayContaining([expect.stringContaining("plan")]),
    });
  });

  it("rejeita reparo estruturalmente válido que altera posição ou duração", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      completionResponse({
        activity: {
          ...generationOutput.activities[0],
          slotIndex: 2,
          durationMinutes: 6,
        },
        uncertainties: [],
      }),
    );
    const provider = new HttpAiProvider(httpConfig, fetchImplementation);

    await expect(provider.repair(createRepairInput())).rejects.toMatchObject({
      code: "invalid_response",
      details: [
        "A atividade reparada não preserva a posição original.",
        "A atividade reparada não preserva a duração obrigatória.",
      ],
    });
  });

  it("rejeita avaliação que omite regras aplicáveis", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      completionResponse({
        results: [],
        summary: { blockingFailures: 0, needsHumanReview: 0 },
      }),
    );
    const provider = new HttpAiProvider(httpConfig, fetchImplementation);

    await expect(provider.evaluate(createValidationInput())).rejects.toMatchObject({
      code: "invalid_response",
      details: ["A avaliação não devolveu exatamente as regras aplicáveis."],
    });
  });

  it("trata corpo HTTP malformado sem expor resposta bruta", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      new Response("nao-e-json", { status: 200 }),
    );
    const provider = new HttpAiProvider(httpConfig, fetchImplementation);

    await expect(provider.generate(createGenerationInput())).rejects.toEqual(
      expect.objectContaining<Partial<AiProviderError>>({
        code: "invalid_response",
        details: ["O corpo HTTP não é um JSON válido."],
      }),
    );
  });

  it("trata status HTTP de erro", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      new Response(null, { status: 429 }),
    );
    const provider = new HttpAiProvider(httpConfig, fetchImplementation);

    await expect(provider.generate(createGenerationInput())).rejects.toMatchObject({
      code: "http_error",
      statusCode: 429,
    });
  });

  it("converte rejeição de rede não relacionada a abort em erro tipado", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () => {
      throw new TypeError("Falha de conexão simulada");
    });
    const provider = new HttpAiProvider(httpConfig, fetchImplementation);

    await expect(provider.generate(createGenerationInput())).rejects.toMatchObject({
      name: "AiProviderError",
      code: "network_error",
      operation: "generation",
      message: "Não foi possível se comunicar com o provedor de IA.",
    });
  });

  it("aborta espera por headers e converte estouro de tempo em erro tipado", async () => {
    const fetchImplementation = vi.fn<typeof fetch>((_input, request) =>
      new Promise<Response>((_resolve, reject) => {
        request?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Abortado", "AbortError"));
        });
      }),
    );
    const provider = new HttpAiProvider(
      { ...httpConfig, timeoutMs: 1 },
      fetchImplementation,
    );

    await expect(provider.generate(createGenerationInput())).rejects.toMatchObject({
      code: "timeout",
      operation: "generation",
    });
  });

  it("mantém o timeout ativo enquanto consome o corpo após os headers", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async (_input, request) => {
      const body = new ReadableStream<Uint8Array>({
        start(streamController) {
          request?.signal?.addEventListener("abort", () => {
            streamController.error(new DOMException("Abortado", "AbortError"));
          });
        },
      });

      return new Response(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const provider = new HttpAiProvider(
      { ...httpConfig, timeoutMs: 1 },
      fetchImplementation,
    );

    await expect(provider.generate(createGenerationInput())).rejects.toMatchObject({
      code: "timeout",
      operation: "generation",
    });
  });
});
