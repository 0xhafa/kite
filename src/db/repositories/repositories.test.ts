import { createClient, type Client } from "@libsql/client";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import curriculumFixture from "../../../data/curriculum.fixture.json";
import type { Activity, ActivityGroup, GenerationBatch } from "../../domain/generation";
import type { ModelRun } from "../../domain/usage";

import { createKiteDatabase, type KiteDatabase } from "../client";
import { migrateDatabase } from "../migrate";
import {
  CurriculumRepository,
  GenerationRepository,
  ModelRunRepository,
  TraceabilityRepository,
} from "./index";

const createdAt = "2026-07-14T12:00:00.000Z";

function createBatch(overrides: Partial<GenerationBatch> = {}): GenerationBatch {
  return {
    id: "batch-1",
    lessonId: "fixture-aula-01",
    themeId: "fonemas",
    curriculumVersion: "fixture-1.0",
    requestedDurationMinutes: 25,
    requestedActivityCount: 2,
    normalizedParameters: { durationMinutes: 25, activityCount: 2 },
    status: "ready_for_review",
    createdAt,
    promptVersion: "generation-1",
    ruleSetVersion: "rules-1",
    cacheKey: "batch-cache-1",
    ...overrides,
  };
}

function createRun(id: string, overrides: Partial<ModelRun> = {}): ModelRun {
  return {
    id,
    batchId: "batch-1",
    stage: "generate",
    provider: "provider-example",
    model: "model-example",
    status: "completed",
    normalizedInput: { lessonId: "fixture-aula-01" },
    inputHash: `hash-${id}`,
    promptTemplateId: "generation",
    promptVersion: "generation-1",
    renderedPrompt: "Gere atividades estruturadas.",
    validatedResponse: { activities: [] },
    ruleSetVersion: "rules-1",
    cacheKey: `cache-${id}`,
    rawUsage: { input_tokens: 60, output_tokens: 40 },
    tokenUsage: {
      inputTokens: 60,
      outputTokens: 40,
      otherTokens: 0,
      totalTokens: 100,
    },
    latencyMilliseconds: 300,
    createdAt,
    ...overrides,
  };
}

const approvedActivity: Activity = {
  id: "activity-1-v1",
  batchId: "batch-1",
  logicalActivityId: "activity-1",
  slotIndex: 0,
  title: "Escuta inicial",
  description: "Escutar e identificar o som inicial.",
  durationMinutes: 10,
  status: "approved",
  version: 1,
  generationRunId: "run-1",
};

const rejectedActivity: Activity = {
  id: "activity-2-v1",
  batchId: "batch-1",
  logicalActivityId: "activity-2",
  slotIndex: 1,
  title: "Trilha sonora",
  description: "Percorrer a trilha dizendo palavras.",
  durationMinutes: 15,
  status: "rejected",
  version: 1,
  generationRunId: "run-2",
};

describe("repositórios libSQL", () => {
  let client: Client;
  let databaseDirectory: string;
  let db: KiteDatabase;
  let generations: GenerationRepository;
  let runs: ModelRunRepository;
  let traceability: TraceabilityRepository;

  beforeEach(async () => {
    databaseDirectory = await mkdtemp(join(tmpdir(), "kite-db-"));
    client = createClient({ url: `file:${join(databaseDirectory, "test.db")}` });
    db = createKiteDatabase(client);
    await migrateDatabase(db);

    await new CurriculumRepository(db).importCurriculum(curriculumFixture);
    generations = new GenerationRepository(db);
    runs = new ModelRunRepository(db);
    traceability = new TraceabilityRepository(db);
    await generations.createBatch(createBatch());
  });

  afterEach(async () => {
    client.close();
    await rm(databaseDirectory, { recursive: true, force: true });
  });

  async function saveInitialGroup(): Promise<ActivityGroup> {
    await runs.save(createRun("run-1"));
    await runs.save(createRun("run-2"));

    return generations.createInitialActivityGroup({
      batchId: "batch-1",
      requestedDurationMinutes: 25,
      requestedActivityCount: 2,
      activities: [approvedActivity, rejectedActivity],
    });
  }

  it("aplica a migration e persiste o currículo e um lote tipado", async () => {
    await migrateDatabase(db);
    expect(await generations.getBatch("batch-1")).toEqual(createBatch());

    await expect(
      generations.createBatch(createBatch({ id: "batch-invalid", requestedDurationMinutes: 0 })),
    ).rejects.toThrow();
  });

  it("regenera apenas a rejeitada e preserva versões, aprovada e duração total", async () => {
    await saveInitialGroup();
    await runs.save(createRun("run-3", { stage: "repair" }));

    const replacement: Activity = {
      ...rejectedActivity,
      id: "activity-2-v2",
      title: "Caça ao som",
      description: "Encontrar imagens que começam com o som indicado.",
      status: "draft",
      version: 2,
      replacesActivityId: rejectedActivity.id,
      generationRunId: "run-3",
    };
    await generations.regenerateActivity(replacement);

    const current = await generations.getCurrentActivityGroup("batch-1");
    const versions = await generations.listActivityVersions("activity-2");

    expect(current?.activities).toEqual([approvedActivity, replacement]);
    expect(current?.activities.reduce((total, item) => total + item.durationMinutes, 0)).toBe(25);
    expect(versions).toEqual([{ ...rejectedActivity, status: "superseded" }, replacement]);
  });

  it("não permite substituir uma atividade aprovada", async () => {
    await saveInitialGroup();
    await runs.save(createRun("run-3", { stage: "repair" }));

    await expect(
      generations.regenerateActivity({
        ...approvedActivity,
        id: "activity-1-v2",
        status: "draft",
        version: 2,
        replacesActivityId: approvedActivity.id,
        generationRunId: "run-3",
      }),
    ).rejects.toThrow(/aprovada/);
    expect(await generations.listActivityVersions("activity-1")).toEqual([approvedActivity]);
  });

  it("registra aplicação, evidência de validação e decisão de revisão", async () => {
    await saveInitialGroup();
    await traceability.saveSource({
      id: "source-1",
      title: "Referência pedagógica",
      authors: ["Autoria exemplo"],
      publicationYear: 2024,
    });
    await traceability.saveEvidenceClaim({
      id: "claim-1",
      sourceId: "source-1",
      statement: "Atividades devem explicitar a ação da criança.",
      location: "p. 10",
      verificationStatus: "verified",
    });
    await traceability.saveRule({
      id: "PED-001",
      version: 1,
      title: "Ação explícita",
      description: "A ação infantil deve estar explícita.",
      applicabilityCondition: "Sempre aplicável.",
      generationInstruction: "Descrever a ação infantil.",
      validationCriterion: "A descrição contém uma ação observável.",
      severity: "blocking",
      origin: "editorial",
      status: "active",
    });
    await traceability.saveRuleSupport({
      ruleId: "PED-001",
      ruleVersion: 1,
      evidenceClaimId: "claim-1",
      supportType: "direct",
    });
    const result = {
      id: "validation-1",
      activityId: approvedActivity.id,
      activityVersion: 1,
      ruleId: "PED-001",
      ruleVersion: 1,
      applicability: "applicable" as const,
      status: "passed" as const,
      evidence: "Escutar e identificar o som inicial.",
      explanation: "A ação de escuta está explícita.",
      confidence: 0.95,
      evaluatorOrigin: "model" as const,
      evaluatorId: "validator-1",
    };
    await traceability.saveValidation(result, {
      activityId: approvedActivity.id,
      activityVersion: 1,
      ruleId: "PED-001",
      ruleVersion: 1,
      applicability: "applicable",
      applicabilityReason: "A regra é editorial e sempre aplicável.",
      validationResultId: result.id,
    });
    await traceability.saveReviewDecision({
      activityId: approvedActivity.id,
      activityVersion: 1,
      decision: "approved",
      author: "revisor-poc",
      createdAt,
    });
    await traceability.saveFeedbackProposal({
      id: "feedback-1",
      reviewActivityId: approvedActivity.id,
      normalizedText: "Manter instruções curtas.",
      suggestedScope: "rule_candidate",
      status: "pending",
    });

    expect(await traceability.listValidationResults(approvedActivity.id, 1)).toEqual([result]);
  });

  it("preserva o histórico de decisões e altera somente a atividade explicitamente revisada", async () => {
    await runs.save(createRun("run-1"));
    await runs.save(createRun("run-2"));
    await generations.createInitialActivityGroup({
      batchId: "batch-1",
      requestedDurationMinutes: 25,
      requestedActivityCount: 2,
      activities: [
        { ...approvedActivity, status: "draft" },
        { ...rejectedActivity, status: "draft" },
      ],
    });

    const approval = {
      activityId: approvedActivity.id,
      activityVersion: 1,
      decision: "approved" as const,
      author: "revisor-poc",
      createdAt: "2026-07-14T12:01:00.000Z",
    };
    const rejection = {
      ...approval,
      decision: "rejected" as const,
      feedback: "A instrução precisa de mais apoio visual.",
      createdAt: "2026-07-14T12:02:00.000Z",
    };

    await expect(
      traceability.saveReviewDecision({ ...approval, feedback: "   " }),
    ).resolves.toEqual(approval);

    expect(await traceability.listReviewDecisions(approvedActivity.id)).toEqual([approval]);
    expect((await generations.getCurrentActivityGroup("batch-1"))?.activities).toEqual([
      approvedActivity,
      { ...rejectedActivity, status: "draft" },
    ]);

    await traceability.saveReviewDecision(rejection);

    expect(await traceability.listReviewDecisions(approvedActivity.id)).toEqual([
      approval,
      rejection,
    ]);
    expect(await traceability.listReviewDecisions(rejectedActivity.id)).toEqual([]);
    expect((await generations.getCurrentActivityGroup("batch-1"))?.activities).toEqual([
      { ...approvedActivity, status: "rejected" },
      { ...rejectedActivity, status: "draft" },
    ]);
  });

  it("agrega tokens e mantém cache ligado à execução original validada", async () => {
    const original = createRun("run-original");
    await runs.save(original);
    await runs.save(
      createRun("run-reused", {
        reusedFromModelRunId: original.id,
        tokenUsage: { inputTokens: 0, outputTokens: 0, otherTokens: 0, totalTokens: 0 },
      }),
    );
    const cacheEntry = {
      cacheKey: original.cacheKey,
      themeId: "fonemas",
      lessonId: "fixture-aula-01",
      curriculumVersion: "fixture-1.0",
      normalizedParameters: { durationMinutes: 25, activityCount: 2 },
      promptVersion: "generation-1",
      ruleSetVersion: "rules-1",
      provider: "provider-example",
      model: "model-example",
      modelRunId: original.id,
      createdAt,
      lastUsedAt: createdAt,
    };
    await runs.saveCacheEntry(cacheEntry);

    expect(await runs.aggregateBatchUsage("batch-1")).toEqual({
      batchId: "batch-1",
      byStage: { plan: 0, generate: 100, validate: 0, repair: 0 },
      totalTokens: 100,
      callCount: 1,
    });
    expect(await runs.findCacheEntry(original.cacheKey)).toEqual(cacheEntry);
    await expect(
      runs.saveCacheEntry({ ...cacheEntry, cacheKey: "invalid-cache", modelRunId: "run-reused" }),
    ).rejects.toThrow(/original/);
  });
});
