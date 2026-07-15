import { z } from "zod";

import {
  activityReviewItemSchema,
  reviewDecisionSchema,
  reviewDecisionTypeSchema,
  type ActivityReviewItem,
  type ReviewDecision,
  type ReviewDecisionType,
} from "./review";

export const reviewSessionDecisionSchema = reviewDecisionSchema.pick({
  decision: true,
  feedback: true,
});

export const reviewSessionDecisionHistorySchema = z.record(
  z.string().trim().min(1).max(200),
  z.array(reviewSessionDecisionSchema),
);

export type ReviewSessionDecision = Pick<ReviewDecision, "decision" | "feedback">;
export type ReviewSessionDecisionHistory = Readonly<
  Record<string, readonly ReviewSessionDecision[]>
>;

export const reviewBatchItemsSchema = z
  .array(activityReviewItemSchema)
  .superRefine((items, context) => {
    const activityIds = new Set<string>();
    const slotIndexes = new Set<number>();
    const batchId = items[0]?.activity.batchId;

    items.forEach(({ activity }, index) => {
      if (activityIds.has(activity.id)) {
        context.addIssue({
          code: "custom",
          message: "Cada atividade deve aparecer uma única vez no lote de revisão.",
          path: [index, "activity", "id"],
        });
      }
      activityIds.add(activity.id);

      if (slotIndexes.has(activity.slotIndex)) {
        context.addIssue({
          code: "custom",
          message: "Cada posição deve aparecer uma única vez no lote de revisão.",
          path: [index, "activity", "slotIndex"],
        });
      }
      slotIndexes.add(activity.slotIndex);

      if (activity.batchId !== batchId) {
        context.addIssue({
          code: "custom",
          message: "Todas as atividades revisadas devem pertencer ao mesmo lote.",
          path: [index, "activity", "batchId"],
        });
      }
    });
  });

export type ReviewSessionState = {
  items: readonly ActivityReviewItem[];
  currentIndex: number | null;
  decisionHistory: ReviewSessionDecisionHistory;
};

export type ReviewProgress = {
  total: number;
  reviewed: number;
  approved: number;
  rejected: number;
  pending: number;
};

export function createReviewSession(
  items: unknown,
  decisionHistory: unknown = {},
): ReviewSessionState {
  const parsedItems = reviewBatchItemsSchema.parse(items);
  const parsedHistory = reviewSessionDecisionHistorySchema.parse(decisionHistory);
  const orderedItems = [...parsedItems].sort(
    (first, second) => first.activity.slotIndex - second.activity.slotIndex,
  );
  const activityIds = new Set(orderedItems.map((item) => item.activity.id));

  for (const activityId of Object.keys(parsedHistory)) {
    if (!activityIds.has(activityId)) {
      throw new Error("O histórico deve pertencer a uma atividade do lote de revisão.");
    }
  }

  const currentIndex = orderedItems.findIndex(
    (item) => !getLatestDecision(parsedHistory[item.activity.id]),
  );

  return {
    items: orderedItems,
    currentIndex: currentIndex >= 0 ? currentIndex : null,
    decisionHistory: parsedHistory,
  };
}

export function getCurrentReviewItem(
  session: ReviewSessionState,
): ActivityReviewItem | null {
  return session.currentIndex === null ? null : session.items[session.currentIndex] ?? null;
}

export function goToReviewItem(
  session: ReviewSessionState,
  index: number,
): ReviewSessionState {
  if (!Number.isInteger(index) || index < 0 || index >= session.items.length) {
    throw new Error("A posição informada não pertence ao lote de revisão.");
  }

  return { ...session, currentIndex: index };
}

export function decideCurrentReviewItem(
  session: ReviewSessionState,
  decision: ReviewDecisionType,
  feedback?: string,
): ReviewSessionState {
  const parsedDecision = reviewDecisionTypeSchema.parse(decision);
  const normalizedFeedback = feedback?.trim() || undefined;
  const historyEntry = reviewSessionDecisionSchema.parse({
    decision: parsedDecision,
    ...(normalizedFeedback ? { feedback: normalizedFeedback } : {}),
  });
  const currentItem = getCurrentReviewItem(session);

  if (!currentItem || session.currentIndex === null) {
    throw new Error("Não há atividade pendente para revisar.");
  }

  const decisionHistory = {
    ...session.decisionHistory,
    [currentItem.activity.id]: [
      ...(session.decisionHistory[currentItem.activity.id] ?? []),
      historyEntry,
    ],
  };
  const nextIndex = findNextPendingIndex(session, decisionHistory);

  return {
    ...session,
    currentIndex: nextIndex,
    decisionHistory,
  };
}

export function getReviewProgress(session: ReviewSessionState): ReviewProgress {
  const decisions = session.items.flatMap((item) => {
    const decision = getLatestDecision(session.decisionHistory[item.activity.id]);
    return decision ? [decision.decision] : [];
  });
  const approved = decisions.filter((decision) => decision === "approved").length;
  const rejected = decisions.filter((decision) => decision === "rejected").length;
  const reviewed = approved + rejected;

  return {
    total: session.items.length,
    reviewed,
    approved,
    rejected,
    pending: Math.max(session.items.length - reviewed, 0),
  };
}

function findNextPendingIndex(
  session: ReviewSessionState,
  decisionHistory: ReviewSessionDecisionHistory,
): number | null {
  if (session.currentIndex === null) {
    return null;
  }

  for (let offset = 1; offset <= session.items.length; offset += 1) {
    const candidateIndex = (session.currentIndex + offset) % session.items.length;
    const candidate = session.items[candidateIndex];

    if (!getLatestDecision(decisionHistory[candidate.activity.id])) {
      return candidateIndex;
    }
  }

  return null;
}

function getLatestDecision(
  history: readonly ReviewSessionDecision[] | undefined,
): ReviewSessionDecision | undefined {
  return history?.at(-1);
}
