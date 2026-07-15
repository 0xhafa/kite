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
  generateAndPersistBatch,
  loadReviewBatch,
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

    expect(initial?.items).toHaveLength(3);
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

  it("usa o provedor HTTP na geração e regeneração e persiste seus metadados reais", async () => {
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
        activities: [{
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
    vi.stubEnv("AI_BASE_URL", "https://ia.example.test/v1/");
    vi.stubEnv("AI_API_KEY", "segredo-que-nao-pode-ser-persistido");
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
    });
    expect(regeneration.item.activity.title).toBe("Substituta entregue por HTTP");
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    for (const [, request] of fetchImplementation.mock.calls) {
      const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
      expect(body).toMatchObject({
        model: "gpt-5.6-terra",
        reasoning_effort: "low",
      });
    }

    const { db } = await getApplicationDatabase();
    const persistedRuns = await new ModelRunRepository(db).listByBatch(batchId);
    const generationRun = persistedRuns.find((run) => run.stage === "generate");
    const repairRun = persistedRuns.find((run) => run.stage === "repair");

    expect(generationRun).toMatchObject({
      provider: "http",
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
      provider: "http",
      model: "gpt-5.6-terra",
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
    expect(JSON.stringify([generationRun, repairRun])).not.toContain(
      "segredo-que-nao-pode-ser-persistido",
    );
  });
});
