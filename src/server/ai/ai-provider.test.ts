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
  providerId: "openai",
  baseUrl: "https://ia.example.test/v1/",
  apiKey: "segredo-do-servidor",
  model: "gpt-5.6-terra",
  reasoningEffort: "low",
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

const validationOutput = {
  results: [
    {
      ruleId: "PED-001",
      ruleVersion: 1,
      status: "passed" as const,
      evidence: currentActivity.description,
      explanation: "A ação observável está explícita.",
      confidence: 0.95,
    },
  ],
  summary: { blockingFailures: 0, needsHumanReview: 0 },
};

function completionResponse(
  content: unknown,
  status = 200,
  usage?: Record<string, unknown>,
): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(content) } }],
      ...(usage ? { usage } : {}),
    }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

describe("configuração do provedor de IA", () => {
  it("usa o mock quando o ambiente não seleciona um provedor", () => {
    expect(loadAiProviderConfig({})).toEqual({ provider: "mock" });
  });

  it("carrega endpoint, segredo e timeout somente do ambiente do servidor", () => {
    expect(
      loadAiProviderConfig({
        AI_PROVIDER: "http",
        OPENAI_BASE_URL: "https://ia.example.test/v1",
        OPENAI_API_KEY: "chave-servidor",
        AI_TIMEOUT_MS: "2500",
        NEXT_PUBLIC_OPENAI_API_KEY: "nao-deve-ser-lida",
      }),
    ).toEqual({
      provider: "http",
      providerId: "openai",
      baseUrl: "https://ia.example.test/v1",
      apiKey: "chave-servidor",
      timeoutMs: 2500,
    });
  });

  it("resolve conexões independentes para Gemini e Groq", () => {
    const environment = {
      AI_PROVIDER: "http",
      OPENAI_API_KEY: "openai-nao-selecionada",
      GEMINI_API_KEY: "gemini-selecionada",
      GROQ_API_KEY: "groq-selecionada",
    };

    expect(loadAiProviderConfig(environment, "gemini")).toEqual({
      provider: "http",
      providerId: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: "gemini-selecionada",
      timeoutMs: 30_000,
    });
    expect(loadAiProviderConfig(environment, "groq")).toEqual({
      provider: "http",
      providerId: "groq",
      baseUrl: "https://api.groq.com/openai/v1/",
      apiKey: "groq-selecionada",
      timeoutMs: 30_000,
    });
  });

  it("não reutiliza a chave de outro provedor quando a selecionada está ausente", () => {
    try {
      loadAiProviderConfig(
        {
          AI_PROVIDER: "http",
          OPENAI_API_KEY: "somente-openai",
        },
        "gemini",
      );
      throw new Error("A configuração sem a chave Gemini deveria falhar.");
    } catch (error) {
      expect(error).toBeInstanceOf(AiConfigurationError);
      expect(error).toMatchObject({
        message: "Configure GEMINI_API_KEY no servidor para usar o provedor selecionado.",
      });
    }
  });

  it("falha com erro tipado quando falta segredo no modo HTTP", () => {
    expect(() =>
      loadAiProviderConfig({
        AI_PROVIDER: "http",
        OPENAI_BASE_URL: "https://ia.example.test/v1",
      }),
    ).toThrowError(AiConfigurationError);

    try {
      loadAiProviderConfig({
        AI_PROVIDER: "http",
        OPENAI_BASE_URL: "https://ia.example.test/v1",
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
    const provider = createAiProvider(undefined, { provider: "mock" });
    const output = await provider.generate(createGenerationInput());

    expect(provider).toBe(mockAiProvider);
    expect(output.output.plan.totalDurationMinutes).toBe(5);
    expect(output.output.activities).toHaveLength(1);
    expect(output.run).toEqual({
      provider: "mock",
      model: "kite-mock-v1",
      rawUsage: { input_tokens: 200, output_tokens: 160 },
      latencyMilliseconds: 1,
    });
  });

  it("cria o adaptador HTTP quando ele é selecionado", () => {
    expect(
      createAiProvider(
        { model: "gpt-5.6-terra", reasoningEffort: "low" },
        {
          provider: "http",
          providerId: "openai",
          baseUrl: httpConfig.baseUrl,
          apiKey: httpConfig.apiKey,
          timeoutMs: httpConfig.timeoutMs,
        },
      ),
    ).toBeInstanceOf(HttpAiProvider);
  });

  it("rejeita conexão que não pertence ao modelo selecionado", () => {
    expect(() =>
      createAiProvider(
        { model: "gemini-3.5-flash", reasoningEffort: "medium" },
        {
          provider: "http",
          providerId: "openai",
          baseUrl: httpConfig.baseUrl,
          apiKey: httpConfig.apiKey,
          timeoutMs: httpConfig.timeoutMs,
        },
      ),
    ).toThrowError(AiConfigurationError);
  });
});

describe("adaptador HTTP estruturado", () => {
  it("envia o modelo configurado e valida a saída de geração com Zod", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      completionResponse(generationOutput),
    );
    const provider = new HttpAiProvider(httpConfig, fetchImplementation);

    await expect(provider.generate(createGenerationInput())).resolves.toMatchObject({
      output: generationOutput,
      run: {
        provider: "openai",
        model: "gpt-5.6-terra",
        reasoningEffort: "low",
      },
    });

    const [url, request] = fetchImplementation.mock.calls[0];
    const body = JSON.parse(String(request?.body)) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
      response_format: { type: string };
      reasoning_effort: string;
    };

    expect(String(url)).toBe("https://ia.example.test/v1/chat/completions");
    expect(request?.headers).toMatchObject({
      Authorization: "Bearer segredo-do-servidor",
    });
    expect(body.model).toBe("gpt-5.6-terra");
    expect(body.reasoning_effort).toBe("low");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0].content).toContain("# Contrato do gerador");
    expect(body.messages[1].content).toBe(
      JSON.stringify(createGenerationInput()),
    );
  });

  it("omite reasoning_effort quando o modelo não oferece esse controle", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      completionResponse(generationOutput),
    );
    const provider = new HttpAiProvider(
      { ...httpConfig, model: "gpt-4.1-mini", reasoningEffort: undefined },
      fetchImplementation,
    );

    await provider.generate(createGenerationInput());

    const body = JSON.parse(
      String(fetchImplementation.mock.calls[0][1]?.body),
    ) as Record<string, unknown>;
    expect(body.model).toBe("gpt-4.1-mini");
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  it("usa o endpoint, modelo e formato de raciocínio próprios da Groq", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      completionResponse(generationOutput),
    );
    const provider = new HttpAiProvider(
      {
        ...httpConfig,
        providerId: "groq",
        baseUrl: "https://api.groq.com/openai/v1/",
        model: "qwen/qwen3.6-27b",
        reasoningEffort: "default",
      },
      fetchImplementation,
    );

    await expect(provider.generate(createGenerationInput())).resolves.toMatchObject({
      run: {
        provider: "groq",
        model: "qwen/qwen3.6-27b",
        reasoningEffort: "default",
      },
    });

    const [url, request] = fetchImplementation.mock.calls[0];
    const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(String(url)).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(body).toMatchObject({
      model: "qwen/qwen3.6-27b",
      reasoning_effort: "default",
      reasoning_format: "hidden",
      response_format: { type: "json_object" },
    });
  });

  it("valida saídas estruturadas de reparo e avaliação", async () => {
    const repairOutput = {
      activity: generationOutput.activities[0],
      uncertainties: [],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(completionResponse(repairOutput))
      .mockResolvedValueOnce(completionResponse(validationOutput));
    const provider = new HttpAiProvider(httpConfig, fetchImplementation);

    await expect(provider.repair(createRepairInput())).resolves.toMatchObject({
      output: repairOutput,
    });
    await expect(provider.evaluate(createValidationInput())).resolves.toMatchObject({
      output: validationOutput,
    });
  });

  it("preserva usage, modelo e latência efetivamente observados na resposta HTTP", async () => {
    const usage = {
      prompt_tokens: 321,
      completion_tokens: 123,
      total_tokens: 444,
    };
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      completionResponse(generationOutput, 200, usage),
    );
    const now = vi.fn<() => number>()
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(142.4);
    const provider = new HttpAiProvider(httpConfig, fetchImplementation, now);

    await expect(provider.generate(createGenerationInput())).resolves.toEqual({
      output: generationOutput,
      run: {
        provider: "openai",
        model: "gpt-5.6-terra",
        reasoningEffort: "low",
        rawUsage: usage,
        latencyMilliseconds: 42,
      },
    });
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
      message:
        "O provedor de IA recusou a solicitação. Tente novamente; se o erro continuar, verifique a configuração do provedor.",
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
      message:
        "Não foi possível se comunicar com o provedor de IA. Verifique a conexão e tente novamente.",
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
      message:
        "O provedor de IA demorou mais que o esperado. Tente novamente em instantes.",
    });
  });

  it("repete uma validação após uma falha transitória", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new DOMException("Abortado", "AbortError"))
      .mockResolvedValueOnce(completionResponse(validationOutput));
    const provider = new HttpAiProvider(httpConfig, fetchImplementation);

    await expect(provider.evaluate(createValidationInput())).resolves.toMatchObject({
      output: validationOutput,
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
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
