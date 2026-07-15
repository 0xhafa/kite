import { z } from "zod";

import {
  aiModelIdSchema,
  aiModelSelectionSchema,
  defaultAiModelSelection,
  reasoningEffortSchema,
} from "./ai-models";
import { positiveIntegerSchema } from "./shared";

export const DEFAULT_DURATION_MINUTES = 25;
export const DEFAULT_ACTIVITY_COUNT = 3;
export const MIN_DURATION_MINUTES = 5;
export const MAX_DURATION_MINUTES = 120;
export const MIN_ACTIVITY_COUNT = 1;
export const MAX_ACTIVITY_COUNT = 10;

export const generationConfigSchema = z
  .object({
    requestedDurationMinutes: positiveIntegerSchema
      .min(
        MIN_DURATION_MINUTES,
        `A duração deve ser de pelo menos ${MIN_DURATION_MINUTES} minutos.`,
      )
      .max(
        MAX_DURATION_MINUTES,
        `A duração deve ser de no máximo ${MAX_DURATION_MINUTES} minutos.`,
      ),
    requestedActivityCount: positiveIntegerSchema
      .min(
        MIN_ACTIVITY_COUNT,
        `A quantidade deve ser de pelo menos ${MIN_ACTIVITY_COUNT} atividade.`,
      )
      .max(
        MAX_ACTIVITY_COUNT,
        `A quantidade deve ser de no máximo ${MAX_ACTIVITY_COUNT} atividades.`,
      ),
    model: aiModelIdSchema,
    reasoningEffort: reasoningEffortSchema.optional(),
  })
  .strict()
  .superRefine((config, context) => {
    if (config.requestedDurationMinutes < config.requestedActivityCount) {
      context.addIssue({
        code: "custom",
        message: "A duração deve permitir pelo menos 1 minuto por atividade.",
        path: ["requestedDurationMinutes"],
      });
    }

    const modelSelection = aiModelSelectionSchema.safeParse({
      model: config.model,
      ...(config.reasoningEffort
        ? { reasoningEffort: config.reasoningEffort }
        : {}),
    });

    if (!modelSelection.success) {
      for (const issue of modelSelection.error.issues) {
        context.addIssue({
          code: "custom",
          message: issue.message,
          path: issue.path,
        });
      }
    }
  });

export const activityDurationEstimateSchema = z
  .object({
    slotIndex: z.number().int().nonnegative(),
    durationMinutes: positiveIntegerSchema,
  })
  .strict();

export const defaultGenerationConfig = generationConfigSchema.parse({
  requestedDurationMinutes: DEFAULT_DURATION_MINUTES,
  requestedActivityCount: DEFAULT_ACTIVITY_COUNT,
  ...defaultAiModelSelection,
});

export function serializeGenerationConfig(input: unknown): GenerationConfig {
  return generationConfigSchema.parse(input);
}

export function estimateActivityDistribution(
  input: GenerationConfig,
): ActivityDurationEstimate[] {
  const config = serializeGenerationConfig(input);
  const baseDuration = Math.floor(
    config.requestedDurationMinutes / config.requestedActivityCount,
  );
  const remainder = config.requestedDurationMinutes % config.requestedActivityCount;

  return Array.from({ length: config.requestedActivityCount }, (_, slotIndex) =>
    activityDurationEstimateSchema.parse({
      slotIndex,
      durationMinutes: baseDuration + (slotIndex < remainder ? 1 : 0),
    }),
  );
}

export type GenerationConfig = z.infer<typeof generationConfigSchema>;
export type ActivityDurationEstimate = z.infer<typeof activityDurationEstimateSchema>;
