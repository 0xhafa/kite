import { describe, expect, it } from "vitest";

import {
  EmptyActivityGroupValidationError,
  validateActivityGroupDeterministically,
} from "./deterministic-validation";
import type { ActivityGroup } from "./generation";
import { validationReportSchema, validationResultSchema } from "./rules";

const createdAt = "2026-07-14T18:00:00.000Z";

const validGroup: ActivityGroup = {
  batchId: "batch-1",
  requestedDurationMinutes: 25,
  requestedActivityCount: 2,
  activities: [
    {
      id: "activity-1-v1",
      batchId: "batch-1",
      logicalActivityId: "activity-1",
      slotIndex: 0,
      title: "Escuta inicial",
      description: "Escutar palavras e identificar o som inicial.",
      durationMinutes: 10,
      status: "draft",
      version: 1,
      generationRunId: "run-1",
    },
    {
      id: "activity-2-v1",
      batchId: "batch-1",
      logicalActivityId: "activity-2",
      slotIndex: 1,
      title: "Trilha sonora",
      description: "Percorrer uma trilha enquanto nomeia as figuras.",
      durationMinutes: 15,
      status: "draft",
      version: 1,
      generationRunId: "run-1",
    },
  ],
};

describe("validação determinística", () => {
  it("produz resultados tipados e evidência para toda regra aprovada", () => {
    const reports = validateActivityGroupDeterministically(validGroup, { createdAt });

    expect(reports).toHaveLength(2);
    reports.forEach((report) => {
      expect(validationReportSchema.safeParse(report).success).toBe(true);
      expect(report.createdAt).toBe(createdAt);
      expect(report.results.every((result) => validationResultSchema.safeParse(result).success)).toBe(
        true,
      );
      expect(
        report.results
          .filter((result) => result.status === "passed")
          .every((result) => Boolean(result.evidence)),
      ).toBe(true);
      expect(report.results.every((result) => result.evaluatorOrigin === "system")).toBe(true);
      expect(report.results.map((result) => result.ruleId)).toEqual([
        "DET-001",
        "DET-002",
        "TIME-001",
        "DET-003",
        "DET-004",
      ]);
      expect(
        report.results.some((result) =>
          ["OPS-001", "OPS-002", "VAR-001", "VAL-001"].includes(result.ruleId),
        ),
      ).toBe(false);
    });
  });

  it("bloqueia todas as atividades quando a soma das durações está incorreta", () => {
    const invalidGroup = {
      ...validGroup,
      activities: [
        validGroup.activities[0],
        { ...validGroup.activities[1], durationMinutes: 14 },
      ],
    };

    const reports = validateActivityGroupDeterministically(invalidGroup, { createdAt });

    reports.forEach((report) => {
      expect(report.results.find((result) => result.ruleId === "TIME-001")?.status).toBe("failed");
      expect(report.summary.blockingFailures).toBeGreaterThan(0);
    });
  });

  it("registra campos ausentes como falhas por regra sem perder a identidade persistível", () => {
    const activityWithoutRequiredFields = { ...validGroup.activities[0] } as Record<
      string,
      unknown
    >;
    delete activityWithoutRequiredFields.title;
    delete activityWithoutRequiredFields.description;

    const reports = validateActivityGroupDeterministically(
      {
        ...validGroup,
        activities: [activityWithoutRequiredFields, validGroup.activities[1]],
      },
      { createdAt },
    );
    const invalidReport = reports[0];

    expect(invalidReport.activityId).toBe(validGroup.activities[0].id);
    expect(invalidReport.results.find((result) => result.ruleId === "DET-001")?.status).toBe(
      "failed",
    );
    expect(invalidReport.results.find((result) => result.ruleId === "DET-002")?.status).toBe(
      "failed",
    );
    expect(invalidReport.results.find((result) => result.ruleId === "DET-004")?.status).toBe(
      "not_evaluated",
    );
  });

  it("bloqueia divergência entre quantidade entregue e solicitada", () => {
    const reports = validateActivityGroupDeterministically(
      {
        ...validGroup,
        requestedActivityCount: 3,
      },
      { createdAt },
    );

    expect(
      reports.every(
        (report) =>
          report.results.find((result) => result.ruleId === "DET-003")?.status === "failed",
      ),
    ).toBe(true);
  });

  it("expõe lote vazio como falha bloqueante tipada de quantidade", () => {
    let thrownError: unknown;

    try {
      validateActivityGroupDeterministically(
        {
          batchId: validGroup.batchId,
          requestedDurationMinutes: 25,
          requestedActivityCount: 2,
          activities: [],
        },
        { createdAt },
      );
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(EmptyActivityGroupValidationError);
    expect(thrownError).toMatchObject({
      blockingFailures: 1,
      failure: {
        ruleId: "DET-003",
        ruleVersion: 1,
        status: "failed",
        evidence: "Quantidade encontrada: 0; solicitada: 2.",
      },
    });
  });

  it("detecta repetição literal simples após normalizar caixa e espaços", () => {
    const reports = validateActivityGroupDeterministically(
      {
        ...validGroup,
        activities: [
          validGroup.activities[0],
          {
            ...validGroup.activities[1],
            title: "  ESCUTA   INICIAL ",
          },
        ],
      },
      { createdAt },
    );

    expect(
      reports.map(
        (report) => report.results.find((result) => result.ruleId === "DET-004")?.status,
      ),
    ).toEqual(["failed", "failed"]);
  });

  it("não usa ausência de duplicação literal para aprovar a variação semântica", () => {
    const reports = validateActivityGroupDeterministically(
      {
        ...validGroup,
        activities: [
          {
            ...validGroup.activities[0],
            title: "Primeira rodada",
            description: "A criança aponta uma figura escolhida pelo professor.",
          },
          {
            ...validGroup.activities[1],
            title: "Segunda rodada",
            description: "A criança aponta outro cartão mostrado pelo professor.",
          },
        ],
      },
      { createdAt },
    );

    reports.forEach((report) => {
      expect(report.results.find((result) => result.ruleId === "DET-004")?.status).toBe("passed");
      expect(report.results.some((result) => result.ruleId === "VAR-001")).toBe(false);
    });
  });

  it("deriva da engine a não aplicabilidade da duplicação em lote unitário", () => {
    const reports = validateActivityGroupDeterministically(
      {
        batchId: validGroup.batchId,
        requestedDurationMinutes: 10,
        requestedActivityCount: 1,
        activities: [validGroup.activities[0]],
      },
      { createdAt },
    );
    const repetitionResult = reports[0].results.find((result) => result.ruleId === "DET-004");

    expect(repetitionResult).toMatchObject({
      applicability: "not_applicable",
      status: "not_applicable",
    });
  });

  it("ordena relatórios por posição e mantém IDs estáveis para a mesma versão", () => {
    const reversedGroup = {
      ...validGroup,
      activities: [...validGroup.activities].reverse(),
    };

    const firstRun = validateActivityGroupDeterministically(reversedGroup, { createdAt });
    const secondRun = validateActivityGroupDeterministically(validGroup, { createdAt });

    expect(firstRun.map((report) => report.activityId)).toEqual([
      "activity-1-v1",
      "activity-2-v1",
    ]);
    expect(firstRun.map((report) => report.results.map((result) => result.id))).toEqual(
      secondRun.map((report) => report.results.map((result) => result.id)),
    );
  });
});
