import { z } from "zod";

import {
  identifierSchema,
  jsonObjectSchema,
  nonEmptyTextSchema,
  nonNegativeIntegerSchema,
  positiveIntegerSchema,
  timestampSchema,
} from "./shared";

export const generationBatchStatusSchema = z.enum([
  "pending",
  "generating",
  "ready_for_review",
  "completed",
  "failed",
]);

export const generationBatchSchema = z
  .object({
    id: identifierSchema,
    lessonId: identifierSchema,
    themeId: identifierSchema,
    curriculumVersion: nonEmptyTextSchema,
    requestedDurationMinutes: positiveIntegerSchema,
    requestedActivityCount: positiveIntegerSchema,
    normalizedParameters: jsonObjectSchema,
    status: generationBatchStatusSchema,
    createdAt: timestampSchema,
    promptVersion: nonEmptyTextSchema,
    ruleSetVersion: nonEmptyTextSchema,
    cacheKey: nonEmptyTextSchema,
    cachedFromBatchId: identifierSchema.optional(),
  })
  .strict()
  .superRefine((batch, context) => {
    if (batch.cachedFromBatchId === batch.id) {
      context.addIssue({
        code: "custom",
        message: "Um lote não pode reutilizar a si próprio.",
        path: ["cachedFromBatchId"],
      });
    }
  });

export const activityStatusSchema = z.enum(["draft", "approved", "rejected", "superseded"]);

export const activitySchema = z
  .object({
    id: identifierSchema,
    batchId: identifierSchema,
    logicalActivityId: identifierSchema,
    slotIndex: nonNegativeIntegerSchema,
    title: nonEmptyTextSchema,
    description: nonEmptyTextSchema,
    durationMinutes: positiveIntegerSchema,
    status: activityStatusSchema,
    version: positiveIntegerSchema,
    replacesActivityId: identifierSchema.optional(),
    generationRunId: identifierSchema,
  })
  .strict()
  .superRefine((activity, context) => {
    if (activity.version === 1 && activity.replacesActivityId) {
      context.addIssue({
        code: "custom",
        message: "A primeira versão não pode substituir outra atividade.",
        path: ["replacesActivityId"],
      });
    }

    if (activity.version > 1 && !activity.replacesActivityId) {
      context.addIssue({
        code: "custom",
        message: "Versões posteriores devem informar a atividade substituída.",
        path: ["replacesActivityId"],
      });
    }

    if (activity.replacesActivityId === activity.id) {
      context.addIssue({
        code: "custom",
        message: "Uma atividade não pode substituir a si própria.",
        path: ["replacesActivityId"],
      });
    }
  });

export const activityGroupSchema = z
  .object({
    batchId: identifierSchema,
    requestedDurationMinutes: positiveIntegerSchema,
    requestedActivityCount: positiveIntegerSchema,
    activities: z.array(activitySchema),
  })
  .strict()
  .superRefine((group, context) => {
    if (group.activities.length !== group.requestedActivityCount) {
      context.addIssue({
        code: "custom",
        message: "A quantidade de atividades deve ser igual à solicitada.",
        path: ["activities"],
      });
    }

    const slotIndexes = new Set<number>();
    const logicalActivityIds = new Set<string>();
    let totalDurationMinutes = 0;

    group.activities.forEach((activity, index) => {
      if (activity.batchId !== group.batchId) {
        context.addIssue({
          code: "custom",
          message: "A atividade deve pertencer ao lote informado.",
          path: ["activities", index, "batchId"],
        });
      }

      if (activity.status === "superseded") {
        context.addIssue({
          code: "custom",
          message: "O grupo atual não pode exibir uma versão substituída.",
          path: ["activities", index, "status"],
        });
      }

      if (slotIndexes.has(activity.slotIndex)) {
        context.addIssue({
          code: "custom",
          message: "Cada posição do lote deve ter uma única atividade atual.",
          path: ["activities", index, "slotIndex"],
        });
      }
      slotIndexes.add(activity.slotIndex);

      if (logicalActivityIds.has(activity.logicalActivityId)) {
        context.addIssue({
          code: "custom",
          message: "Cada atividade lógica deve aparecer uma única vez no grupo atual.",
          path: ["activities", index, "logicalActivityId"],
        });
      }
      logicalActivityIds.add(activity.logicalActivityId);
      totalDurationMinutes += activity.durationMinutes;
    });

    for (let slotIndex = 0; slotIndex < group.requestedActivityCount; slotIndex += 1) {
      if (!slotIndexes.has(slotIndex)) {
        context.addIssue({
          code: "custom",
          message: `A posição ${slotIndex} não possui atividade.`,
          path: ["activities"],
        });
      }
    }

    if (totalDurationMinutes !== group.requestedDurationMinutes) {
      context.addIssue({
        code: "custom",
        message: "A soma das durações deve ser igual à duração solicitada para o grupo.",
        path: ["activities"],
      });
    }
  });

export const activityRegenerationSchema = z
  .object({
    group: activityGroupSchema,
    replacement: activitySchema,
  })
  .strict()
  .superRefine(({ group, replacement }, context) => {
    const replacedActivity = group.activities.find(
      (activity) => activity.id === replacement.replacesActivityId,
    );

    if (!replacedActivity) {
      context.addIssue({
        code: "custom",
        message: "A atividade substituída deve estar no grupo atual.",
        path: ["replacement", "replacesActivityId"],
      });
      return;
    }

    const preservedFields = ["batchId", "logicalActivityId", "slotIndex", "durationMinutes"] as const;

    for (const field of preservedFields) {
      if (replacement[field] !== replacedActivity[field]) {
        context.addIssue({
          code: "custom",
          message: `A regeneração deve preservar ${field}.`,
          path: ["replacement", field],
        });
      }
    }

    if (replacement.version !== replacedActivity.version + 1) {
      context.addIssue({
        code: "custom",
        message: "A substituta deve incrementar a versão anterior em uma unidade.",
        path: ["replacement", "version"],
      });
    }

    if (replacement.status !== "draft") {
      context.addIssue({
        code: "custom",
        message: "Uma atividade regenerada deve iniciar como rascunho.",
        path: ["replacement", "status"],
      });
    }
  });

export function applyActivityRegeneration(input: ActivityRegeneration): ActivityGroup {
  const parsedInput = activityRegenerationSchema.parse(input);
  const replacementIndex = parsedInput.group.activities.findIndex(
    (activity) => activity.id === parsedInput.replacement.replacesActivityId,
  );
  const activities = [...parsedInput.group.activities];
  activities[replacementIndex] = parsedInput.replacement;

  return activityGroupSchema.parse({
    ...parsedInput.group,
    activities,
  });
}

export type GenerationBatchStatus = z.infer<typeof generationBatchStatusSchema>;
export type GenerationBatch = z.infer<typeof generationBatchSchema>;
export type ActivityStatus = z.infer<typeof activityStatusSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type ActivityGroup = z.infer<typeof activityGroupSchema>;
export type ActivityRegeneration = z.infer<typeof activityRegenerationSchema>;
