import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import curriculumData from "../../../data/curriculum.json";
import { adaptCurriculum } from "@/domain/curriculum-adapter";
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

  it("reconstrói o lote, preserva aprovação e persiste a substituta", async () => {
    const batchId = await generateAndPersistBatch({
      selection,
      config: { requestedDurationMinutes: 25, requestedActivityCount: 3 },
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
    const artifacts = createInitialGenerationArtifacts({
      curriculum,
      selection,
      config: { requestedDurationMinutes: 5, requestedActivityCount: 1 },
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
});
