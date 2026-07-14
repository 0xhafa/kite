import { z } from "zod";

import {
  activityReviewItemSchema,
  reviewDecisionTypeSchema,
  type ActivityReviewItem,
  type ReviewDecisionType,
} from "./review";

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
  decisions: Readonly<Record<string, ReviewDecisionType>>;
};

export type ReviewProgress = {
  total: number;
  reviewed: number;
  approved: number;
  rejected: number;
  pending: number;
};

export function createReviewSession(items: unknown): ReviewSessionState {
  const parsedItems = reviewBatchItemsSchema.parse(items);
  const orderedItems = [...parsedItems].sort(
    (first, second) => first.activity.slotIndex - second.activity.slotIndex,
  );

  return {
    items: orderedItems,
    currentIndex: orderedItems.length > 0 ? 0 : null,
    decisions: {},
  };
}

export function getCurrentReviewItem(
  session: ReviewSessionState,
): ActivityReviewItem | null {
  return session.currentIndex === null ? null : session.items[session.currentIndex] ?? null;
}

export function decideCurrentReviewItem(
  session: ReviewSessionState,
  decision: ReviewDecisionType,
): ReviewSessionState {
  const parsedDecision = reviewDecisionTypeSchema.parse(decision);
  const currentItem = getCurrentReviewItem(session);

  if (!currentItem || session.currentIndex === null) {
    throw new Error("Não há atividade pendente para revisar.");
  }

  const decisions = {
    ...session.decisions,
    [currentItem.activity.id]: parsedDecision,
  };
  const nextIndex = findNextPendingIndex(session, decisions);

  return {
    ...session,
    currentIndex: nextIndex,
    decisions,
  };
}

export function getReviewProgress(session: ReviewSessionState): ReviewProgress {
  const decisions = Object.values(session.decisions);
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
  decisions: Readonly<Record<string, ReviewDecisionType>>,
): number | null {
  if (session.currentIndex === null) {
    return null;
  }

  for (let offset = 1; offset <= session.items.length; offset += 1) {
    const candidateIndex = (session.currentIndex + offset) % session.items.length;
    const candidate = session.items[candidateIndex];

    if (!decisions[candidate.activity.id]) {
      return candidateIndex;
    }
  }

  return null;
}
