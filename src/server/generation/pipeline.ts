import { randomUUID } from "node:crypto";

import rulesData from "../../../data/rules.json";
import type {
  AiFailedAttempt,
  AiProvider,
  AiRunMetadata,
} from "@/domain/ai-provider";
import {
  aiModelSelectionSchema,
  getAiModelDefinition,
  type AiModelSelection,
} from "@/domain/ai-models";
import { selectApplicableRuleInputs } from "@/domain/applicability";
import type { Curriculum, Lesson } from "@/domain/curriculum";
import type {
  CompleteCurriculumSelection,
  CurriculumSelection,
} from "@/domain/curriculum-navigation";
import { validateActivityGroupDeterministically } from "@/domain/deterministic-validation";
import {
  activityGroupSchema,
  applyActivityRegeneration,
  generationBatchSchema,
  type Activity,
  type ActivityGroup,
} from "@/domain/generation";
import {
  generationConfigSchema,
  type GenerationConfig,
} from "@/domain/generation-config";
import type {
  ApplicableRuleInput,
  CurriculumLessonContext,
} from "@/domain/model-contracts";
import type { ActivityReviewItem, ReviewRuleReference } from "@/domain/review";
import type { ValidationModelResult, ValidationReport } from "@/domain/rules";
import { loadRuleCatalog } from "@/domain/rules-catalog";
import {
  modelRunSchema,
  normalizeTokenUsage,
  type ModelRun,
} from "@/domain/usage";
import { AiProviderError, createAiProvider } from "@/server/ai";

export type GenerationPipelineInput = {
  curriculum: Curriculum;
  selection: CompleteCurriculumSelection;
  config: GenerationConfig;
};

export type PipelineOptions = {
  batchId?: string;
  createdAt?: string;
  createId?: (prefix: string) => string;
  now?: () => string;
  provider?: AiProvider;
};

export type InitialGenerationArtifacts = {
  batch: ReturnType<typeof generationBatchSchema.parse>;
  group: ActivityGroup;
  reports: ValidationReport[];
  generationRun: ModelRun;
  validationRuns: ModelRun[];
  curriculumContext: CurriculumLessonContext;
  applicableRules: ApplicableRuleInput[];
};

export type RegenerationPipelineInput = {
  group: ActivityGroup;
  currentActivity: Activity;
  currentReport: ValidationReport;
  curriculumContext: CurriculumLessonContext;
  applicableRules: ApplicableRuleInput[];
  feedback?: string;
  promptVersion: string;
  ruleSetVersion: string;
  modelSelection: AiModelSelection;
};

export type RegenerationArtifacts = {
  replacement: Activity;
  report: ValidationReport;
  failedRepairRuns: ModelRun[];
  repairRun: ModelRun;
  validationRun: ModelRun;
};

export class RepairExhaustedError extends Error {
  readonly name = "RepairExhaustedError";

  constructor(
    message: string,
    readonly failedRepairRuns: readonly ModelRun[],
  ) {
    super(message);
  }
}

const catalog = loadRuleCatalog(rulesData);
const catalogRulesByKey = new Map(
  catalog.rules.map((rule) => [`${rule.id}:${rule.version}`, rule]),
);
const promptVersion = "generation-3";
const ruleSetVersion = `rules-${catalog.version}`;
const traceabilitySource = {
  id: "kite-rule-catalog",
  title: "Catálogo versionado de regras pedagógicas do Kite",
  authors: ["Equipe Kite"],
  publicationYear: 2026,
  locator: `Catálogo ${ruleSetVersion}`,
};

function defaultCreateId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

function createRuntime(options: PipelineOptions, modelSelection: AiModelSelection) {
  return {
    createId: options.createId ?? defaultCreateId,
    now: options.now ?? (() => new Date().toISOString()),
    provider: options.provider ?? createAiProvider(modelSelection),
  };
}

export function createPendingGenerationBatch(
  input: GenerationPipelineInput,
  options: Pick<PipelineOptions, "batchId" | "createdAt" | "createId" | "now"> = {},
) {
  const config = generationConfigSchema.parse(input.config);
  const modelSelection = aiModelSelectionSchema.parse({
    model: config.model,
    ...(config.reasoningEffort
      ? { reasoningEffort: config.reasoningEffort }
      : {}),
  });
  const curriculumContext = resolveCurriculumContext(input.curriculum, input.selection);
  const batchId = options.batchId
    ?? (options.createId ?? defaultCreateId)("batch");
  const createdAt = options.createdAt
    ?? (options.now ?? (() => new Date().toISOString()))();

  return generationBatchSchema.parse({
    id: batchId,
    lessonId: curriculumContext.lesson.id,
    themeId: curriculumContext.themeId,
    curriculumVersion: curriculumContext.curriculumVersion,
    requestedDurationMinutes: config.requestedDurationMinutes,
    requestedActivityCount: config.requestedActivityCount,
    normalizedParameters: {
      durationMinutes: config.requestedDurationMinutes,
      activityCount: config.requestedActivityCount,
      model: config.model,
      ...(config.reasoningEffort
        ? { reasoningEffort: config.reasoningEffort }
        : {}),
      selection: input.selection,
    },
    status: "pending",
    createdAt,
    promptVersion,
    ruleSetVersion,
    cacheKey: `${getAiModelDefinition(modelSelection.model).provider}:${batchId}`,
  });
}

export function resolveCurriculumContext(
  curriculum: Curriculum,
  selection: CompleteCurriculumSelection,
): CurriculumLessonContext {
  const theme = curriculum.themes.find(({ id }) => id === selection.themeId);
  const skill = theme?.skills.find(({ id }) => id === selection.skillId);
  const objective = skill?.objectives.find(({ id }) => id === selection.objectiveId);
  const week = objective?.weeks.find(({ id }) => id === selection.weekId);
  const lesson = week?.lessons.find(({ id }) => id === selection.lessonId);

  if (!theme || !skill || !objective || !week || !lesson) {
    throw new Error("A seleção curricular não corresponde a uma aula do currículo vigente.");
  }

  return {
    themeId: theme.id,
    curriculumVersion: curriculum.version,
    skillId: skill.id,
    objectiveId: objective.id,
    objectiveName: objective.name,
    weekId: week.id,
    lesson,
  };
}

function getProgressionContext(
  curriculum: Curriculum,
  selection: CompleteCurriculumSelection,
  lesson: Lesson,
): string[] {
  const context = resolveCurriculumContext(curriculum, selection);
  const theme = curriculum.themes.find(({ id }) => id === context.themeId)!;
  const skill = theme.skills.find(({ id }) => id === context.skillId)!;
  const objective = skill.objectives.find(({ id }) => id === context.objectiveId)!;
  const week = objective.weeks.find(({ id }) => id === context.weekId)!;

  return week.lessons
    .filter((candidate) => candidate.number < lesson.number)
    .map((candidate) => candidate.content);
}

function applicableRulesFor(activityCount: number): ApplicableRuleInput[] {
  const signals = [
    "uses_words",
    "uses_images",
    "has_editorial_template",
    ...(activityCount > 1 ? (["multiple_activities"] as const) : []),
  ] as const;

  return selectApplicableRuleInputs(catalog, { signals: [...signals] });
}

function stableHash(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 2_166_136_261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0).toString(36);
}

function createCompletedRun(input: {
  id: string;
  batchId: string;
  activityId?: string;
  stage: "generate" | "validate" | "repair";
  normalizedInput: unknown;
  validatedResponse: unknown;
  run: AiRunMetadata;
  createdAt: string;
  promptVersion: string;
  ruleSetVersion: string;
}): ModelRun {
  return modelRunSchema.parse({
    id: input.id,
    batchId: input.batchId,
    ...(input.activityId ? { activityId: input.activityId } : {}),
    stage: input.stage,
    provider: input.run.provider,
    model: input.run.model,
    ...(input.run.reasoningEffort
      ? { reasoningEffort: input.run.reasoningEffort }
      : {}),
    status: "completed",
    normalizedInput: input.normalizedInput,
    inputHash: stableHash(input.normalizedInput),
    promptTemplateId: `${input.run.provider}-${input.stage}`,
    promptVersion: input.promptVersion,
    renderedPrompt: `Execução estruturada da etapa ${input.stage} pelo provedor ${input.run.provider}.`,
    validatedResponse: input.validatedResponse,
    ruleSetVersion: input.ruleSetVersion,
    cacheKey: `${input.run.provider}:${input.stage}:${input.batchId}:${input.activityId ?? "batch"}:${stableHash(input.normalizedInput)}`,
    ...(input.run.rawUsage ? { rawUsage: input.run.rawUsage } : {}),
    tokenUsage: normalizeTokenUsage(input.run.rawUsage),
    latencyMilliseconds: input.run.latencyMilliseconds,
    createdAt: input.createdAt,
  });
}

function createFailedRun(input: {
  id: string;
  batchId: string;
  activityId: string;
  normalizedInput: unknown;
  attempt: AiFailedAttempt;
  createdAt: string;
  promptVersion: string;
  ruleSetVersion: string;
}): ModelRun {
  return modelRunSchema.parse({
    id: input.id,
    batchId: input.batchId,
    activityId: input.activityId,
    stage: "repair",
    provider: input.attempt.run.provider,
    model: input.attempt.run.model,
    ...(input.attempt.run.reasoningEffort
      ? { reasoningEffort: input.attempt.run.reasoningEffort }
      : {}),
    status: "failed",
    normalizedInput: input.normalizedInput,
    inputHash: stableHash(input.normalizedInput),
    promptTemplateId: `${input.attempt.run.provider}-repair`,
    promptVersion: input.promptVersion,
    renderedPrompt: `Execução estruturada da etapa repair pelo provedor ${input.attempt.run.provider}.`,
    ruleSetVersion: input.ruleSetVersion,
    cacheKey: `${input.attempt.run.provider}:repair:${input.batchId}:${input.activityId}:${input.id}`,
    ...(input.attempt.run.rawUsage ? { rawUsage: input.attempt.run.rawUsage } : {}),
    tokenUsage: normalizeTokenUsage(input.attempt.run.rawUsage),
    latencyMilliseconds: input.attempt.run.latencyMilliseconds,
    error: input.attempt.error,
    createdAt: input.createdAt,
  });
}

function repairFailureMessage(error: AiProviderError): string {
  if (error.code !== "invalid_response") {
    return `Não foi possível ajustar a atividade. ${error.message}`;
  }

  const reason = error.details[0] ?? "A resposta não atendeu ao contrato esperado.";
  const attemptLabel = error.attempts.length === 1 ? "tentativa" : "tentativas";
  return [
    `Não foi possível ajustar a atividade após ${error.attempts.length} ${attemptLabel}.`,
    reason,
    "Revise o feedback ou o modelo configurado e tente novamente.",
  ].join(" ");
}

export async function createInitialGenerationArtifacts(
  input: GenerationPipelineInput,
  options: PipelineOptions = {},
): Promise<InitialGenerationArtifacts> {
  const config = generationConfigSchema.parse(input.config);
  const modelSelection = aiModelSelectionSchema.parse({
    model: config.model,
    ...(config.reasoningEffort
      ? { reasoningEffort: config.reasoningEffort }
      : {}),
  });
  const runtime = createRuntime(options, modelSelection);
  const curriculumContext = resolveCurriculumContext(input.curriculum, input.selection);
  const applicableRules = applicableRulesFor(config.requestedActivityCount);
  const createdAt = options.createdAt ?? runtime.now();
  const batchId = options.batchId ?? runtime.createId("batch");
  const pendingBatch = createPendingGenerationBatch(input, { batchId, createdAt });
  const generationRunId = runtime.createId("run-generate");
  const modelInput = {
    curriculum: curriculumContext,
    progressionContext: getProgressionContext(
      input.curriculum,
      input.selection,
      curriculumContext.lesson,
    ),
    totalDurationMinutes: config.requestedDurationMinutes,
    activityCount: config.requestedActivityCount,
    applicableRules,
    preservedActivities: [],
    localFeedback: [],
    editorialTemplateVersion: promptVersion,
  };
  const generationResult = await runtime.provider.generate(modelInput);
  const generated = generationResult.output;
  const activities = generated.activities.map((proposal) => ({
    id: runtime.createId(`activity-${proposal.slotIndex + 1}-v1`),
    batchId,
    logicalActivityId: runtime.createId(`logical-${proposal.slotIndex + 1}`),
    slotIndex: proposal.slotIndex,
    title: proposal.title,
    description: proposal.description,
    durationMinutes: proposal.durationMinutes,
    status: "draft" as const,
    version: 1,
    generationRunId,
  }));
  const group = activityGroupSchema.parse({
    batchId,
    requestedDurationMinutes: config.requestedDurationMinutes,
    requestedActivityCount: config.requestedActivityCount,
    activities,
  });
  const reports = validateActivityGroupDeterministically(group, { createdAt });
  const generationRun = createCompletedRun({
    id: generationRunId,
    batchId,
    stage: "generate",
    normalizedInput: modelInput,
    validatedResponse: generated,
    run: generationResult.run,
    createdAt,
    promptVersion,
    ruleSetVersion,
  });
  const validationRuns = reports.map((report) =>
    createCompletedRun({
      id: runtime.createId(`run-validate-${report.activityId}`),
      batchId,
      activityId: report.activityId,
      stage: "validate",
      normalizedInput: { activityId: report.activityId, activityVersion: report.activityVersion },
      validatedResponse: report,
      run: {
        provider: "mock",
        model: "kite-mock-v1",
        rawUsage: { input_tokens: 70, output_tokens: 20 },
        latencyMilliseconds: 1,
      },
      createdAt,
      promptVersion,
      ruleSetVersion,
    }),
  );

  return {
    batch: generationBatchSchema.parse({
      ...pendingBatch,
      status: "ready_for_review",
    }),
    group,
    reports,
    generationRun,
    validationRuns,
    curriculumContext,
    applicableRules,
  };
}

function repairFailures(report: ValidationReport): ValidationModelResult[] {
  const failures = report.results.filter(
    (result) => result.status !== "passed" && result.status !== "not_applicable",
  );

  if (failures.length > 0) {
    return failures.map(({ ruleId, ruleVersion, status, evidence, explanation, confidence }) => ({
      ruleId,
      ruleVersion,
      status,
      ...(evidence ? { evidence } : {}),
      explanation,
      confidence,
    }));
  }

  const fallback = report.results[0];
  if (!fallback) {
    throw new Error("A atividade rejeitada precisa possuir resultados de validação.");
  }

  return [{
    ruleId: fallback.ruleId,
    ruleVersion: fallback.ruleVersion,
    status: "needs_review",
    explanation: "A revisão humana rejeitou a versão atual e solicitou uma alternativa.",
    confidence: 1,
  }];
}

export async function createRegenerationArtifacts(
  input: RegenerationPipelineInput,
  options: PipelineOptions = {},
): Promise<RegenerationArtifacts> {
  const runtime = createRuntime(options, input.modelSelection);
  const createdAt = runtime.now();
  const repairRunId = runtime.createId("run-repair");
  const repairInput = {
    currentActivity: input.currentActivity,
    requiredDurationMinutes: input.currentActivity.durationMinutes,
    validationFailures: repairFailures(input.currentReport),
    ...(input.feedback?.trim() ? { feedback: input.feedback.trim() } : {}),
    preservedActivities: input.group.activities.filter(
      (activity) => activity.id !== input.currentActivity.id,
    ),
    curriculum: input.curriculumContext,
    applicableRules: input.applicableRules,
  };
  const createFailedRepairRuns = (
    attempts: readonly AiFailedAttempt[],
  ): ModelRun[] => attempts.map((attempt, index) =>
    createFailedRun({
      id: runtime.createId(`run-repair-failed-${index + 1}`),
      batchId: input.group.batchId,
      activityId: input.currentActivity.id,
      normalizedInput: repairInput,
      attempt,
      createdAt,
      promptVersion: input.promptVersion,
      ruleSetVersion: input.ruleSetVersion,
    }));
  let repairResult;

  try {
    repairResult = await runtime.provider.repair(repairInput);
  } catch (error) {
    if (error instanceof AiProviderError && error.attempts.length > 0) {
      throw new RepairExhaustedError(
        repairFailureMessage(error),
        createFailedRepairRuns(error.attempts),
      );
    }

    throw error;
  }

  const generated = repairResult.output;
  const replacement: Activity = {
    id: runtime.createId(`activity-${input.currentActivity.slotIndex + 1}-v${input.currentActivity.version + 1}`),
    batchId: input.currentActivity.batchId,
    logicalActivityId: input.currentActivity.logicalActivityId,
    slotIndex: input.currentActivity.slotIndex,
    title: generated.activity.title,
    description: generated.activity.description,
    durationMinutes: input.currentActivity.durationMinutes,
    status: "draft",
    version: input.currentActivity.version + 1,
    replacesActivityId: input.currentActivity.id,
    generationRunId: repairRunId,
  };
  const updatedGroup = applyActivityRegeneration({ group: input.group, replacement });
  const report = validateActivityGroupDeterministically(updatedGroup, { createdAt }).find(
    (candidate) => candidate.activityId === replacement.id,
  );

  if (!report) {
    throw new Error("A atividade substituta não recebeu relatório de validação.");
  }

  return {
    replacement,
    report,
    failedRepairRuns: createFailedRepairRuns(
      repairResult.failedAttempts ?? [],
    ),
    repairRun: createCompletedRun({
      id: repairRunId,
      batchId: input.group.batchId,
      activityId: input.currentActivity.id,
      stage: "repair",
      normalizedInput: repairInput,
      validatedResponse: generated,
      run: repairResult.run,
      createdAt,
      promptVersion: input.promptVersion,
      ruleSetVersion: input.ruleSetVersion,
    }),
    validationRun: createCompletedRun({
      id: runtime.createId(`run-validate-${replacement.id}`),
      batchId: input.group.batchId,
      activityId: replacement.id,
      stage: "validate",
      normalizedInput: { activityId: replacement.id, activityVersion: replacement.version },
      validatedResponse: report,
      run: {
        provider: "mock",
        model: "kite-mock-v1",
        rawUsage: { input_tokens: 70, output_tokens: 20 },
        latencyMilliseconds: 1,
      },
      createdAt,
      promptVersion: input.promptVersion,
      ruleSetVersion: input.ruleSetVersion,
    }),
  };
}

export function createReviewItem(
  activity: Activity,
  report: ValidationReport,
): ActivityReviewItem {
  const ruleReferences: ReviewRuleReference[] = report.results.map((result) => {
    const rule = catalogRulesByKey.get(`${result.ruleId}:${result.ruleVersion}`);
    if (!rule) {
      throw new Error(`A regra ${result.ruleId}:${result.ruleVersion} não existe no catálogo.`);
    }

    return {
      ruleId: rule.id,
      ruleVersion: rule.version,
      title: rule.title,
      description: rule.description,
      origin: rule.origin,
      sources: [traceabilitySource],
    };
  });

  return { activity, validationReport: report, ruleReferences };
}

export function isCompleteSelection(
  selection: CurriculumSelection,
): selection is CompleteCurriculumSelection {
  return Object.values(selection).every((value) => typeof value === "string" && value.length > 0);
}
