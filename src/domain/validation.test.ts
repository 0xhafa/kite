import { describe, expect, it } from "vitest";

import { type Activity } from "./generation";
import { activityReviewItemSchema, feedbackProposalSchema } from "./review";
import { validationModelOutputSchema, validationReportSchema } from "./rules";

const activity: Activity = {
  id: "activity-1-v1",
  batchId: "batch-1",
  logicalActivityId: "activity-1",
  slotIndex: 0,
  title: "Escuta inicial",
  description: "Escutar e identificar o som inicial.",
  durationMinutes: 25,
  status: "draft",
  version: 1,
  generationRunId: "run-1",
};

const report = {
  activityId: activity.id,
  activityVersion: activity.version,
  results: [
    {
      id: "validation-1",
      activityId: activity.id,
      activityVersion: activity.version,
      ruleId: "PED-001",
      ruleVersion: 1,
      applicability: "applicable" as const,
      status: "passed" as const,
      evidence: "Escutar e identificar o som inicial.",
      explanation: "A ação de escuta está explícita.",
      confidence: 0.94,
      evaluatorOrigin: "model" as const,
      evaluatorId: "validator-v1",
    },
  ],
  summary: {
    blockingFailures: 0,
    needsHumanReview: 0,
  },
  createdAt: "2026-07-14T12:00:00.000Z",
};

const ruleReferences = [
  {
    ruleId: "PED-001",
    ruleVersion: 1,
    title: "Praticar a habilidade prioritária",
    origin: "pedagogical_inference" as const,
    sources: [
      {
        id: "source-1",
        title: "Referência pedagógica",
        authors: ["Equipe pedagógica"],
      },
    ],
  },
];

describe("rastreabilidade da validação", () => {
  it("não permite declarar uma regra atendida sem evidência", () => {
    const outputWithoutEvidence = {
      results: [
        {
          ruleId: "PED-001",
          ruleVersion: 1,
          status: "passed",
          explanation: "Parece adequada.",
          confidence: 0.8,
        },
      ],
      summary: { blockingFailures: 0, needsHumanReview: 0 },
    };

    expect(validationModelOutputSchema.safeParse(outputWithoutEvidence).success).toBe(false);
  });

  it("vincula cada relatório à atividade e versão exibidas", () => {
    expect(
      activityReviewItemSchema.parse({ activity, validationReport: report, ruleReferences }),
    ).toBeDefined();
    expect(
      activityReviewItemSchema.safeParse({
        activity,
        validationReport: { ...report, activityVersion: 2 },
        ruleReferences,
      }).success,
    ).toBe(false);
  });

  it("exige uma referência tipada para cada regra exibida no relatório", () => {
    expect(
      activityReviewItemSchema.safeParse({
        activity,
        validationReport: report,
        ruleReferences: [],
      }).success,
    ).toBe(false);

    expect(
      activityReviewItemSchema.safeParse({
        activity,
        validationReport: report,
        ruleReferences: [{ ...ruleReferences[0], ruleVersion: 2 }],
      }).success,
    ).toBe(false);
  });

  it("mantém o resumo de revisão humana coerente com os resultados", () => {
    expect(validationReportSchema.parse(report).summary.needsHumanReview).toBe(0);

    expect(
      validationReportSchema.safeParse({
        ...report,
        results: [{ ...report.results[0], status: "needs_review", evidence: undefined }],
        summary: { blockingFailures: 0, needsHumanReview: 0 },
      }).success,
    ).toBe(false);
  });
});

describe("feedback", () => {
  it("não transforma feedback pendente em regra global", () => {
    expect(
      feedbackProposalSchema.safeParse({
        id: "feedback-1",
        reviewActivityId: activity.id,
        normalizedText: "Evitar fichas impressas.",
        suggestedScope: "rule_candidate",
        status: "pending",
        createdRuleId: "PED-099",
        createdRuleVersion: 1,
      }).success,
    ).toBe(false);
  });
});
