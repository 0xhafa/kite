import { describe, expect, it } from "vitest";

import curriculumData from "../../../data/curriculum.json";
import { adaptCurriculum } from "@/domain/curriculum-adapter";
import { applyActivityRegeneration } from "@/domain/generation";
import { aggregateBatchTokenUsage } from "@/domain/usage";

import {
  createInitialGenerationArtifacts,
  createRegenerationArtifacts,
} from "./pipeline";

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
const now = () => "2026-07-14T20:00:00.000Z";
let sequence = 0;
const createId = (prefix: string) => `${prefix}-test-${sequence++}`;

describe("pipeline integrado de geração", () => {
  it("gera um grupo válido com relatório por atividade e tokens por etapa", () => {
    sequence = 0;
    const artifacts = createInitialGenerationArtifacts(
      {
        curriculum,
        selection,
        config: { requestedDurationMinutes: 25, requestedActivityCount: 3 },
      },
      { createId, now },
    );

    expect(artifacts.group.activities).toHaveLength(3);
    expect(
      artifacts.group.activities.reduce(
        (total, activity) => total + activity.durationMinutes,
        0,
      ),
    ).toBe(25);
    expect(artifacts.reports.map((report) => report.activityId)).toEqual(
      artifacts.group.activities.map((activity) => activity.id),
    );
    expect(artifacts.reports.every((report) => report.results.length > 0)).toBe(true);

    const usage = aggregateBatchTokenUsage(artifacts.batch.id, [
      artifacts.generationRun,
      ...artifacts.validationRuns,
    ]);
    expect(usage.byStage.generate).toBeGreaterThan(0);
    expect(usage.byStage.validate).toBeGreaterThan(0);
    expect(usage.byStage.repair).toBe(0);
  });

  it("substitui só a versão rejeitada e preserva posição, duração e total", () => {
    sequence = 0;
    const initial = createInitialGenerationArtifacts(
      {
        curriculum,
        selection,
        config: { requestedDurationMinutes: 25, requestedActivityCount: 3 },
      },
      { createId, now },
    );
    const rejected = initial.group.activities[1];
    const artifacts = createRegenerationArtifacts(
      {
        group: initial.group,
        currentActivity: rejected,
        currentReport: initial.reports[1],
        curriculumContext: initial.curriculumContext,
        applicableRules: initial.applicableRules,
        feedback: "Criar uma alternativa mais visual.",
        promptVersion: initial.batch.promptVersion,
        ruleSetVersion: initial.batch.ruleSetVersion,
      },
      { createId, now },
    );
    const updated = applyActivityRegeneration({
      group: initial.group,
      replacement: artifacts.replacement,
    });

    expect(artifacts.replacement).toMatchObject({
      logicalActivityId: rejected.logicalActivityId,
      slotIndex: rejected.slotIndex,
      durationMinutes: rejected.durationMinutes,
      version: 2,
      replacesActivityId: rejected.id,
    });
    expect(updated.activities[0]).toEqual(initial.group.activities[0]);
    expect(updated.activities[2]).toEqual(initial.group.activities[2]);
    expect(updated.activities.reduce((total, activity) => total + activity.durationMinutes, 0)).toBe(25);
    expect(artifacts.report.activityId).toBe(artifacts.replacement.id);
    expect(artifacts.repairRun.tokenUsage.totalTokens).toBeGreaterThan(0);
  });
});
