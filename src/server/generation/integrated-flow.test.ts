import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import curriculumData from "../../../data/curriculum.json";
import { adaptCurriculum } from "@/domain/curriculum-adapter";
import { defaultAiModelSelection } from "@/domain/ai-models";
import { GenerationRepository, ModelRunRepository } from "@/db/repositories";
import { getApplicationDatabase } from "@/server/application-database";

import {
  approveActivity,
  createPersistedGenerationRequest,
  deletePersistedBatch,
  generateAndPersistBatch,
  loadGenerationBatchStatus,
  loadPersistedPlanningContext,
  loadReviewBatch,
  loadReviewPageBatch,
  loadReviewedActivityLibrary,
  markGenerationBatchFailed,
  rejectActivity,
  rejectAndRegenerateActivity,
} from "./integrated-flow";
import { createInitialGenerationArtifacts } from "./pipeline";

const curriculum = adaptCurriculum(curriculumData);
const theme = curriculum.themes[0];
const skill = theme.skills[0];
const objective = skill.objectives[0];
const week = objective.weeks[0];
const lesson = week.lessons[0];
const selection = {
  themeId: theme.id,
  skillId: skill.id,
  objectiveId: objective.id,
  weekId: week.id,
  lessonId: lesson.id,
};

function completionResponse(
  content: unknown,
  usage: Record<string, number>,
): Response {
  return Response.json({
    choices: [{ message: { content: JSON.stringify(content) } }],
    usage,
  });
}

describe("fluxo integrado persistido", () => {
  let databaseDirectory: string;

  beforeAll(async () => {
    databaseDirectory = await mkdtemp(join(tmpdir(), "kite-integrated-flow-"));
    process.env.DATABASE_URL = `file:${join(databaseDirectory, "flow.db")}`;
  });

  afterAll(async () => {
    delete process.env.DATABASE_URL;
    await rm(databaseDirectory, { recursive: true, force: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("expõe o estado pendente enquanto o workflow ainda não terminou", async () => {
    const pending = await createPersistedGenerationRequest({
      selection,
      config: {
        requestedDurationMinutes: 25,
        requestedActivityCount: 3,
        ...defaultAiModelSelection,
      },
    });

    await expect(loadReviewPageBatch(pending.batchId)).resolves.toEqual({
      status: "generating",
      modelSelection: defaultAiModelSelection,
    });
    await expect(loadGenerationBatchStatus(pending.batchId)).resolves.toBe("generating");
    await markGenerationBatchFailed(pending.batchId);
    await expect(loadGenerationBatchStatus(pending.batchId)).resolves.toBe("failed");
    await deletePersistedBatch(pending.batchId);
    await expect(loadGenerationBatchStatus(pending.batchId)).resolves.toBe("missing");
  });

  it("reconstrói o lote, preserva aprovação e persiste a substituta", async () => {
    const batchId = await generateAndPersistBatch({
      selection,
      config: {
        requestedDurationMinutes: 25,
        requestedActivityCount: 3,
        ...defaultAiModelSelection,
      },
    });
    const initial = await loadReviewBatch(batchId);
    const planningContext = await loadPersistedPlanningContext(batchId);

    await expect(loadGenerationBatchStatus(batchId)).resolves.toBe("ready");

    expect(initial?.items).toHaveLength(3);
    expect(planningContext).toEqual({
      batchId,
      modelSelection: defaultAiModelSelection,
      selection,
    });
    expect(initial?.items.every((item) => item.validationReport.results.length > 0)).toBe(true);
    expect(initial?.usage.byStage.generate).toBeGreaterThan(0);
    expect(initial?.usage.byStage.validate).toBeGreaterThan(0);

    const approved = initial!.items[0].activity;
    await approveActivity({
      batchId,
      activityId: approved.id,
      activityVersion: approved.version,
    });

    const rejected = initial!.items[1].activity;
    const originalTotal = initial!.items.reduce(
      (total, item) => total + item.activity.durationMinutes,
      0,
    );
    const regeneration = await rejectAndRegenerateActivity({
      batchId,
      activityId: rejected.id,
      activityVersion: rejected.version,
      feedback: "Criar outra ação para a criança.",
    });
    const reloaded = await loadReviewBatch(batchId);
    const replacement = reloaded!.items.find(
      (item) => item.activity.logicalActivityId === rejected.logicalActivityId,
    )!.activity;

    expect(reloaded?.decisionHistory[approved.id]?.at(-1)?.decision).toBe("approved");
    expect(replacement).toMatchObject({
      version: 2,
      replacesActivityId: rejected.id,
      durationMinutes: rejected.durationMinutes,
      slotIndex: rejected.slotIndex,
    });
    expect(reloaded!.items[0].activity.id).toBe(approved.id);
    expect(reloaded!.items.reduce(
      (total, item) => total + item.activity.durationMinutes,
      0,
    )).toBe(originalTotal);
    expect(regeneration.usage.byStage.repair).toBeGreaterThan(0);
    expect(reloaded?.usage).toEqual(regeneration.usage);

    for (const item of reloaded!.items.filter(({ activity }) => activity.status !== "approved")) {
      await approveActivity({
        batchId,
        activityId: item.activity.id,
        activityVersion: item.activity.version,
      });
    }

    const completed = await loadReviewBatch(batchId);
    const libraryBatch = (await loadReviewedActivityLibrary()).find(
      (entry) => entry.batchId === batchId,
    );

    expect(completed?.batch.status).toBe("completed");
    expect(completed?.decisionHistory).toMatchObject({
      [approved.id]: [{ decision: "approved" }],
      [replacement.id]: [{ decision: "approved" }],
    });
    expect(libraryBatch).toMatchObject({
      batchId,
      completed: true,
      totalActivities: 3,
      theme: { id: theme.id, name: theme.name },
      skill: { id: skill.id, name: skill.name },
      objective: { id: objective.id, name: objective.name },
      week: { id: week.id, number: week.number, title: week.title },
      lesson: {
        id: lesson.id,
        number: lesson.number,
        specificObjective: lesson.specificObjective,
      },
    });
    expect(libraryBatch?.reviewedActivities).toHaveLength(3);
    expect(libraryBatch?.usage).toEqual(completed?.usage);
  });

  it("permite aprovar novamente e rejeitar uma atividade depois da aprovação", async () => {
    const batchId = await generateAndPersistBatch({
      selection,
      config: {
        requestedDurationMinutes: 5,
        requestedActivityCount: 1,
        ...defaultAiModelSelection,
      },
    });
    const initial = await loadReviewBatch(batchId);
    const approvedActivity = initial!.items[0].activity;

    await approveActivity({
      batchId,
      activityId: approvedActivity.id,
      activityVersion: approvedActivity.version,
    });
    await approveActivity({
      batchId,
      activityId: approvedActivity.id,
      activityVersion: approvedActivity.version,
      feedback: "Aprovação confirmada na releitura.",
    });

    const reapproved = await loadReviewBatch(batchId);
    expect(reapproved?.batch.status).toBe("completed");
    expect(reapproved?.decisionHistory[approvedActivity.id]).toMatchObject([
      { decision: "approved" },
      { decision: "approved", feedback: "Aprovação confirmada na releitura." },
    ]);

    const regeneration = await rejectAndRegenerateActivity({
      batchId,
      activityId: approvedActivity.id,
      activityVersion: approvedActivity.version,
      feedback: "Na nova leitura, é melhor trocar a ação da criança.",
    });
    const reopened = await loadReviewBatch(batchId);

    expect(regeneration.item.activity).toMatchObject({
      version: 2,
      replacesActivityId: approvedActivity.id,
      status: "draft",
    });
    expect(reopened?.batch.status).toBe("ready_for_review");
    expect(reopened?.items[0].activity.id).toBe(regeneration.item.activity.id);
    expect(reopened?.decisionHistory[regeneration.item.activity.id]).toEqual([]);

    await approveActivity({
      batchId,
      activityId: regeneration.item.activity.id,
      activityVersion: regeneration.item.activity.version,
    });
    await expect(loadReviewBatch(batchId)).resolves.toMatchObject({
      batch: { status: "completed" },
    });
  });

  it("conclui o lote quando todas as atividades foram aprovadas ou rejeitadas", async () => {
    const batchId = await generateAndPersistBatch({
      selection,
      config: {
        requestedDurationMinutes: 10,
        requestedActivityCount: 2,
        ...defaultAiModelSelection,
      },
    });
    const initial = await loadReviewBatch(batchId);
    const rejectedActivity = initial!.items[0].activity;
    const approvedActivity = initial!.items[1].activity;

    await rejectActivity({
      batchId,
      activityId: rejectedActivity.id,
      activityVersion: rejectedActivity.version,
      feedback: "Não atende à intenção pedagógica.",
    });

    await expect(loadReviewBatch(batchId)).resolves.toMatchObject({
      batch: { status: "ready_for_review" },
      items: [
        { activity: { id: rejectedActivity.id, status: "rejected" } },
        { activity: { id: approvedActivity.id, status: "draft" } },
      ],
    });

    await approveActivity({
      batchId,
      activityId: approvedActivity.id,
      activityVersion: approvedActivity.version,
    });

    const completed = await loadReviewBatch(batchId);
    const libraryBatch = (await loadReviewedActivityLibrary()).find(
      (entry) => entry.batchId === batchId,
    );

    expect(completed).toMatchObject({
      batch: { status: "completed" },
      decisionHistory: {
        [rejectedActivity.id]: [{
          decision: "rejected",
          feedback: "Não atende à intenção pedagógica.",
        }],
        [approvedActivity.id]: [{ decision: "approved" }],
      },
    });
    expect(libraryBatch).toMatchObject({
      batchId,
      completed: true,
      reviewedActivities: [
        { activity: { status: "rejected" }, decision: { decision: "rejected" } },
        { activity: { status: "approved" }, decision: { decision: "approved" } },
      ],
    });
  });

  it("não entrega uma atividade cujo relatório validado ficou incompleto", async () => {
    const artifacts = await createInitialGenerationArtifacts({
      curriculum,
      selection,
      config: {
        requestedDurationMinutes: 5,
        requestedActivityCount: 1,
        ...defaultAiModelSelection,
      },
    });
    const { db } = await getApplicationDatabase();
    const generations = new GenerationRepository(db);
    const runs = new ModelRunRepository(db);

    await generations.createBatch(artifacts.batch);
    await runs.save(artifacts.generationRun);
    await generations.createInitialActivityGroup(artifacts.group);
    await runs.save(artifacts.validationRuns[0]);

    await expect(loadReviewBatch(artifacts.batch.id)).rejects.toThrow(
      /não foi persistida por completo/,
    );
  });

  it("permite trocar o provedor na regeneração e restaura a última seleção", async () => {
    const generationUsage = {
      prompt_tokens: 321,
      completion_tokens: 123,
      total_tokens: 444,
    };
    const repairUsage = {
      prompt_tokens: 111,
      completion_tokens: 55,
      total_tokens: 166,
    };
    const generationOutput = {
      plan: {
        totalDurationMinutes: 5,
        slots: [{
          slotIndex: 0,
          durationMinutes: 5,
          primaryChildAction: "Apontar",
          pedagogicalFunction: "Relacionar som e imagem",
        }],
      },
      activities: [{
        slotIndex: 0,
        title: "Atividade entregue por HTTP",
        description: "A criança aponta a imagem cujo nome começa com o som trabalhado.",
        durationMinutes: 5,
        consideredRuleIds: [],
      }],
      uncertainties: [],
    };
    const repairOutput = {
      activity: {
        slotIndex: 0,
        title: "Substituta entregue por HTTP",
        description: "A criança separa a imagem cujo nome começa com o som trabalhado.",
        durationMinutes: 5,
        consideredRuleIds: [],
      },
      uncertainties: [],
    };
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(completionResponse(generationOutput, generationUsage))
      .mockResolvedValueOnce(completionResponse(repairOutput, repairUsage));

    vi.stubEnv("AI_PROVIDER", "http");
    vi.stubEnv("OPENAI_BASE_URL", "https://openai.example.test/v1/");
    vi.stubEnv("OPENAI_API_KEY", "segredo-openai-que-nao-pode-ser-persistido");
    vi.stubEnv("GEMINI_BASE_URL", "https://gemini.example.test/v1beta/openai/");
    vi.stubEnv("GEMINI_API_KEY", "segredo-gemini-que-nao-pode-ser-persistido");
    vi.stubEnv("AI_TIMEOUT_MS", "1000");
    vi.stubGlobal("fetch", fetchImplementation);

    const batchId = await generateAndPersistBatch({
      selection,
      config: {
        requestedDurationMinutes: 5,
        requestedActivityCount: 1,
        model: "gpt-5.6-terra",
        reasoningEffort: "low",
      },
    });
    const initial = await loadReviewBatch(batchId);
    const currentActivity = initial!.items[0].activity;

    expect(currentActivity.title).toBe("Atividade entregue por HTTP");

    const regeneration = await rejectAndRegenerateActivity({
      batchId,
      activityId: currentActivity.id,
      activityVersion: currentActivity.version,
      feedback: "Trocar a ação da criança.",
      modelSelection: {
        model: "gemini-3.5-flash",
        reasoningEffort: "low",
      },
    });
    expect(regeneration.item.activity.title).toBe("Substituta entregue por HTTP");
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(String(fetchImplementation.mock.calls[0]?.[0])).toBe(
      "https://openai.example.test/v1/chat/completions",
    );
    expect(String(fetchImplementation.mock.calls[1]?.[0])).toBe(
      "https://gemini.example.test/v1beta/openai/chat/completions",
    );
    expect(JSON.parse(String(fetchImplementation.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: "gpt-5.6-terra",
      reasoning_effort: "low",
    });
    expect(JSON.parse(String(fetchImplementation.mock.calls[1]?.[1]?.body))).toMatchObject({
      model: "gemini-3.5-flash",
      reasoning_effort: "low",
    });

    const { db } = await getApplicationDatabase();
    const persistedRuns = await new ModelRunRepository(db).listByBatch(batchId);
    const generationRun = persistedRuns.find((run) => run.stage === "generate");
    const repairRun = persistedRuns.find((run) => run.stage === "repair");

    expect(generationRun).toMatchObject({
      provider: "openai",
      model: "gpt-5.6-terra",
      reasoningEffort: "low",
      rawUsage: generationUsage,
      tokenUsage: {
        inputTokens: 321,
        outputTokens: 123,
        otherTokens: 0,
        totalTokens: 444,
      },
      latencyMilliseconds: expect.any(Number),
    });
    expect(repairRun).toMatchObject({
      provider: "gemini",
      model: "gemini-3.5-flash",
      reasoningEffort: "low",
      rawUsage: repairUsage,
      tokenUsage: {
        inputTokens: 111,
        outputTokens: 55,
        otherTokens: 0,
        totalTokens: 166,
      },
      latencyMilliseconds: expect.any(Number),
    });
    const persistedData = JSON.stringify([generationRun, repairRun]);
    expect(persistedData).not.toContain("segredo-openai-que-nao-pode-ser-persistido");
    expect(persistedData).not.toContain("segredo-gemini-que-nao-pode-ser-persistido");

    const reloaded = await loadReviewBatch(batchId);
    expect(reloaded?.modelSelection).toEqual({
      model: "gemini-3.5-flash",
      reasoningEffort: "low",
    });
  });
});
