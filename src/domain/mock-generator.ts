import type { ZodError } from "zod";

import {
  estimateActivityDistribution,
  generationConfigSchema,
} from "./generation-config";
import {
  type GenerationModelInput,
  type GenerationModelOutput,
  generationModelInputSchema,
  generationModelOutputSchema,
} from "./model-contracts";

type MockActivityTemplate = {
  primaryChildAction: string;
  pedagogicalFunction: string;
  title: string;
  instruction: string;
};

const MOCK_ACTIVITY_TEMPLATES = [
  {
    primaryChildAction: "Observar",
    pedagogicalFunction: "Ativar conhecimentos prévios",
    title: "Olhar de investigador",
    instruction: "observa os exemplos e conta o que percebe",
  },
  {
    primaryChildAction: "Escutar",
    pedagogicalFunction: "Desenvolver percepção auditiva",
    title: "Ouvidos atentos",
    instruction: "escuta os sons e sinaliza quando reconhece o foco da aula",
  },
  {
    primaryChildAction: "Apontar",
    pedagogicalFunction: "Relacionar som e representação",
    title: "Aponte a pista",
    instruction: "aponta a imagem que corresponde ao desafio apresentado",
  },
  {
    primaryChildAction: "Separar",
    pedagogicalFunction: "Classificar exemplos e não exemplos",
    title: "Cada som em seu lugar",
    instruction: "separa as opções em grupos de acordo com o que escuta",
  },
  {
    primaryChildAction: "Combinar",
    pedagogicalFunction: "Estabelecer relações entre elementos",
    title: "Duplas que combinam",
    instruction: "combina cartões que compartilham a característica estudada",
  },
  {
    primaryChildAction: "Repetir",
    pedagogicalFunction: "Praticar produção oral guiada",
    title: "Eco de palavras",
    instruction: "repete as palavras propostas, cuidando da produção do som",
  },
  {
    primaryChildAction: "Nomear",
    pedagogicalFunction: "Ampliar produção oral autônoma",
    title: "Qual é o nome?",
    instruction: "nomeia as figuras e destaca o som trabalhado",
  },
  {
    primaryChildAction: "Comparar",
    pedagogicalFunction: "Perceber semelhanças e diferenças",
    title: "Parecidos ou diferentes",
    instruction: "compara duas palavras e explica o que soa igual ou diferente",
  },
  {
    primaryChildAction: "Ordenar",
    pedagogicalFunction: "Organizar uma sequência de aprendizagem",
    title: "Trilha em ordem",
    instruction: "ordena os cartões conforme a sequência combinada com a turma",
  },
  {
    primaryChildAction: "Explicar",
    pedagogicalFunction: "Sistematizar a aprendizagem da aula",
    title: "Conte o que descobriu",
    instruction: "explica com suas palavras o que aprendeu no desafio",
  },
] as const satisfies readonly MockActivityTemplate[];

export type MockGeneratorSchemaStage = "input" | "output";

export class MockGeneratorSchemaError extends Error {
  readonly name = "MockGeneratorSchemaError";

  constructor(
    readonly stage: MockGeneratorSchemaStage,
    readonly details: readonly string[],
  ) {
    const contract = stage === "input" ? "entrada" : "saída";
    super(`Não foi possível gerar o lote mock: a ${contract} não atende ao contrato.`);
  }
}

function createSchemaError(
  stage: MockGeneratorSchemaStage,
  error: ZodError,
): MockGeneratorSchemaError {
  return new MockGeneratorSchemaError(
    stage,
    error.issues.map((issue) => issue.message),
  );
}

export function generateMockBatch(input: GenerationModelInput): GenerationModelOutput {
  const inputResult = generationModelInputSchema.safeParse(input);

  if (!inputResult.success) {
    throw createSchemaError("input", inputResult.error);
  }

  const parsedInput = inputResult.data;
  const configResult = generationConfigSchema.safeParse({
    requestedDurationMinutes: parsedInput.totalDurationMinutes,
    requestedActivityCount: parsedInput.activityCount,
  });

  if (!configResult.success) {
    throw createSchemaError("input", configResult.error);
  }

  const distribution = estimateActivityDistribution(configResult.data);
  const consideredRuleIds = [
    ...new Set(parsedInput.applicableRules.map((rule) => rule.ruleId)),
  ];
  const lesson = parsedInput.curriculum.lesson;

  const planActivities = distribution.map(({ slotIndex, durationMinutes }) => {
    const template = MOCK_ACTIVITY_TEMPLATES[slotIndex];

    return {
      slotIndex,
      durationMinutes,
      primaryChildAction: template.primaryChildAction,
      pedagogicalFunction: template.pedagogicalFunction,
    };
  });

  const activities = distribution.map(({ slotIndex, durationMinutes }) => {
    const template = MOCK_ACTIVITY_TEMPLATES[slotIndex];

    return {
      slotIndex,
      title: template.title,
      description: `A criança ${template.instruction} para explorar ${lesson.content}, conforme o objetivo curricular: ${lesson.specificObjective}.`,
      durationMinutes,
      consideredRuleIds,
    };
  });

  const outputResult = generationModelOutputSchema.safeParse({
    plan: {
      totalDurationMinutes: parsedInput.totalDurationMinutes,
      activities: planActivities,
    },
    activities,
    uncertainties: [],
  });

  if (!outputResult.success) {
    throw createSchemaError("output", outputResult.error);
  }

  return outputResult.data;
}
