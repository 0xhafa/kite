import { describe, expect, it } from "vitest";

import type { ActivityReviewItem } from "./review";
import {
  createReviewSession,
  decideCurrentReviewItem,
  getCurrentReviewItem,
  getReviewProgress,
  reviewBatchItemsSchema,
} from "./review-session";

function createItem(
  slotIndex: number,
  overrides: Partial<ActivityReviewItem> = {},
): ActivityReviewItem {
  const activityId = `atividade-${slotIndex + 1}`;

  return {
    activity: {
      id: activityId,
      batchId: "lote-1",
      logicalActivityId: `atividade-logica-${slotIndex + 1}`,
      slotIndex,
      title: `Atividade ${slotIndex + 1}`,
      description: "Descrição pedagógica da atividade.",
      durationMinutes: 5,
      status: "draft",
      version: 1,
      generationRunId: "execucao-1",
    },
    validationReport: {
      activityId,
      activityVersion: 1,
      results: [],
      summary: {
        blockingFailures: 0,
        needsHumanReview: 0,
      },
      createdAt: "2026-07-14T13:20:10-03:00",
    },
    ruleReferences: [],
    ...overrides,
  };
}

describe("sessão de revisão", () => {
  it("ordena as atividades pela posição e inicia na primeira", () => {
    const session = createReviewSession([createItem(2), createItem(0), createItem(1)]);

    expect(session.items.map((item) => item.activity.slotIndex)).toEqual([0, 1, 2]);
    expect(getCurrentReviewItem(session)?.activity.id).toBe("atividade-1");
    expect(getReviewProgress(session)).toEqual({
      total: 3,
      reviewed: 0,
      approved: 0,
      rejected: 0,
      pending: 3,
    });
  });

  it("registra decisões sem alterar a sessão anterior e avança uma atividade por vez", () => {
    const initialSession = createReviewSession([createItem(0), createItem(1)]);
    const afterApproval = decideCurrentReviewItem(
      initialSession,
      "approved",
      "  Instrução adequada.  ",
    );
    const completedSession = decideCurrentReviewItem(afterApproval, "rejected", "");

    expect(initialSession.decisionHistory).toEqual({});
    expect(afterApproval.decisionHistory).toEqual({
      "atividade-1": [{ decision: "approved", feedback: "Instrução adequada." }],
    });
    expect(completedSession.decisionHistory).toEqual({
      "atividade-1": [{ decision: "approved", feedback: "Instrução adequada." }],
      "atividade-2": [{ decision: "rejected" }],
    });
    expect(getCurrentReviewItem(afterApproval)?.activity.id).toBe("atividade-2");
    expect(getReviewProgress(afterApproval)).toEqual({
      total: 2,
      reviewed: 1,
      approved: 1,
      rejected: 0,
      pending: 1,
    });
    expect(getCurrentReviewItem(completedSession)).toBeNull();
    expect(getReviewProgress(completedSession)).toEqual({
      total: 2,
      reviewed: 2,
      approved: 1,
      rejected: 1,
      pending: 0,
    });
  });

  it("carrega o histórico sem alterar uma atividade aprovada nem outras atividades", () => {
    const history = {
      "atividade-1": [
        { decision: "rejected" as const, feedback: "Detalhar a mediação." },
        { decision: "approved" as const },
      ],
    };
    const session = createReviewSession([createItem(0), createItem(1)], history);

    expect(session.decisionHistory).toEqual(history);
    expect(getCurrentReviewItem(session)?.activity.id).toBe("atividade-2");
    expect(getReviewProgress(session)).toEqual({
      total: 2,
      reviewed: 1,
      approved: 1,
      rejected: 0,
      pending: 1,
    });

    const completedSession = decideCurrentReviewItem(session, "rejected");
    expect(completedSession.decisionHistory["atividade-1"]).toEqual(history["atividade-1"]);
  });

  it("representa um lote vazio sem atividade atual", () => {
    const session = createReviewSession([]);

    expect(getCurrentReviewItem(session)).toBeNull();
    expect(getReviewProgress(session)).toMatchObject({ total: 0, pending: 0 });
    expect(() => decideCurrentReviewItem(session, "approved")).toThrow(
      "Não há atividade pendente para revisar.",
    );
  });

  it("recusa itens duplicados e relatórios de outra atividade", () => {
    const firstItem = createItem(0);
    const duplicateId = createItem(1, {
      activity: {
        ...createItem(1).activity,
        id: firstItem.activity.id,
      },
    });
    const mismatchedReport = createItem(2, {
      validationReport: {
        ...createItem(2).validationReport,
        activityId: "outra-atividade",
      },
    });

    expect(reviewBatchItemsSchema.safeParse([firstItem, duplicateId]).success).toBe(false);
    expect(reviewBatchItemsSchema.safeParse([mismatchedReport]).success).toBe(false);
  });

  it("recusa histórico de uma atividade que não pertence ao lote", () => {
    expect(() =>
      createReviewSession([createItem(0)], {
        "atividade-externa": [{ decision: "approved" }],
      }),
    ).toThrow("O histórico deve pertencer a uma atividade do lote de revisão.");
  });
});
