import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import curriculumData from "../../../data/curriculum.json";
import { adaptCurriculum } from "@/domain/curriculum-adapter";
import { applyActivityRegeneration } from "@/domain/generation";
import { defaultAiModelSelection } from "@/domain/ai-models";
import { aggregateBatchTokenUsage } from "@/domain/usage";
import { AiProviderError, mockAiProvider } from "@/server/ai";

import {
  createInitialGenerationArtifacts,
  createPendingGenerationBatch,
  createRegenerationArtifacts,
  RepairExhaustedError,
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
  it("não acopla o fluxo aos geradores mock do domínio", async () => {
    const source = await readFile(new URL("./pipeline.ts", import.meta.url), "utf8");

    expect(source).not.toContain("@/domain/mock-generator");
    expect(source).not.toMatch(/generateMock(?:Batch|Repair)/u);
  });

  it("prepara um lote pendente com identidade estável antes de chamar a IA", () => {
    const batch = createPendingGenerationBatch(
      {
        curriculum,
        selection,
        config: {
          requestedDurationMinutes: 25,
          requestedActivityCount: 3,
          ...defaultAiModelSelection,
        },
      },
      {
        batchId: "batch-pending-test",
        createdAt: now(),
      },
    );

    expect(batch).toMatchObject({
      id: "batch-pending-test",
      status: "pending",
      createdAt: now(),
      cacheKey: "openai:batch-pending-test",
    });
  });

  it("gera um grupo válido com relatório por atividade e tokens por etapa", async () => {
    sequence = 0;
    const artifacts = await createInitialGenerationArtifacts(
      {
        curriculum,
        selection,
        config: {
          requestedDurationMinutes: 25,
          requestedActivityCount: 3,
          ...defaultAiModelSelection,
        },
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
    expect(artifacts.batch.promptVersion).toBe("generation-3");

    const usage = aggregateBatchTokenUsage(artifacts.batch.id, [
      artifacts.generationRun,
      ...artifacts.validationRuns,
    ]);
    expect(usage.byStage.generate).toBeGreaterThan(0);
    expect(usage.byStage.validate).toBeGreaterThan(0);
    expect(usage.byStage.repair).toBe(0);
  });

  it("substitui só a versão rejeitada e preserva posição, duração e total", async () => {
    sequence = 0;
    const initial = await createInitialGenerationArtifacts(
      {
        curriculum,
        selection,
        config: {
          requestedDurationMinutes: 25,
          requestedActivityCount: 3,
          ...defaultAiModelSelection,
        },
      },
      { createId, now },
    );
    const rejected = initial.group.activities[1];
    const artifacts = await createRegenerationArtifacts(
      {
        group: initial.group,
        currentActivity: rejected,
        currentReport: initial.reports[1],
        curriculumContext: initial.curriculumContext,
        applicableRules: initial.applicableRules,
        feedback: "Criar uma alternativa mais visual.",
        promptVersion: initial.batch.promptVersion,
        ruleSetVersion: initial.batch.ruleSetVersion,
        modelSelection: defaultAiModelSelection,
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

  it("materializa a tentativa inválida antes do reparo concluído sem fabricar uso", async () => {
    sequence = 0;
    const initial = await createInitialGenerationArtifacts(
      {
        curriculum,
        selection,
        config: {
          requestedDurationMinutes: 5,
          requestedActivityCount: 1,
          ...defaultAiModelSelection,
        },
      },
      { createId, now },
    );
    const rejected = initial.group.activities[0];
    const provider = {
      ...mockAiProvider,
      async repair(input: Parameters<typeof mockAiProvider.repair>[0]) {
        const result = await mockAiProvider.repair(input);
        return {
          ...result,
          failedAttempts: [{
            run: {
              provider: "openai",
              model: "gpt-5.6-terra",
              latencyMilliseconds: 18,
            },
            error: "O reparo não preservou a duração obrigatória.",
          }],
        };
      },
    };

    const artifacts = await createRegenerationArtifacts(
      {
        group: initial.group,
        currentActivity: rejected,
        currentReport: initial.reports[0],
        curriculumContext: initial.curriculumContext,
        applicableRules: initial.applicableRules,
        promptVersion: initial.batch.promptVersion,
        ruleSetVersion: initial.batch.ruleSetVersion,
        modelSelection: defaultAiModelSelection,
      },
      { createId, now, provider },
    );
    const failedRun = artifacts.failedRepairRuns[0];
    const usage = aggregateBatchTokenUsage(initial.batch.id, [
      failedRun,
      artifacts.repairRun,
    ]);

    expect(failedRun).toMatchObject({
      activityId: rejected.id,
      stage: "repair",
      status: "failed",
      error: "O reparo não preservou a duração obrigatória.",
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        otherTokens: 0,
        totalTokens: 0,
      },
    });
    expect(failedRun).not.toHaveProperty("validatedResponse");
    expect(usage.callCount).toBe(2);
    expect(usage.byStage.repair).toBe(180);
  });

  it("entrega runs falhos seguros quando todas as respostas de reparo se esgotam", async () => {
    sequence = 0;
    const initial = await createInitialGenerationArtifacts(
      {
        curriculum,
        selection,
        config: {
          requestedDurationMinutes: 5,
          requestedActivityCount: 1,
          ...defaultAiModelSelection,
        },
      },
      { createId, now },
    );
    const rejected = initial.group.activities[0];
    const provider = {
      ...mockAiProvider,
      async repair() {
        throw new AiProviderError(
          "invalid_response",
          "repair",
          ["A atividade reparada não preserva a duração obrigatória."],
          undefined,
          undefined,
          [
            {
              run: {
                provider: "openai",
                model: "gpt-5.6-terra",
                rawUsage: { input_tokens: 10 },
                latencyMilliseconds: 12,
              },
              error: "Resposta inválida na etapa de reparo.",
            },
            {
              run: {
                provider: "openai",
                model: "gpt-5.6-terra",
                latencyMilliseconds: 14,
              },
              error: "Resposta inválida na etapa de reparo.",
            },
          ],
        );
      },
    };

    try {
      await createRegenerationArtifacts(
        {
          group: initial.group,
          currentActivity: rejected,
          currentReport: initial.reports[0],
          curriculumContext: initial.curriculumContext,
          applicableRules: initial.applicableRules,
          promptVersion: initial.batch.promptVersion,
          ruleSetVersion: initial.batch.ruleSetVersion,
          modelSelection: defaultAiModelSelection,
        },
        { createId, now, provider },
      );
      throw new Error("O reparo deveria esgotar as tentativas.");
    } catch (error) {
      expect(error).toBeInstanceOf(RepairExhaustedError);
      expect(error).toMatchObject({
        message: expect.stringMatching(/ajustar a atividade após 2 tentativas/i),
        failedRepairRuns: [
          { status: "failed", tokenUsage: { totalTokens: 10 } },
          { status: "failed", tokenUsage: { totalTokens: 0 } },
        ],
      });
      expect(JSON.stringify(error)).not.toContain("segredo");
    }
  });
});
