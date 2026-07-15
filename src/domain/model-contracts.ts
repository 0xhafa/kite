import { z } from "zod";

import { lessonSchema } from "./curriculum";
import { activitySchema } from "./generation";
import { validationModelResultSchema } from "./rules";
import {
  identifierSchema,
  nonEmptyTextSchema,
  nonNegativeIntegerSchema,
  positiveIntegerSchema,
} from "./shared";

export const curriculumLessonContextSchema = z
  .object({
    themeId: identifierSchema,
    curriculumVersion: nonEmptyTextSchema,
    skillId: identifierSchema,
    objectiveId: identifierSchema,
    objectiveName: nonEmptyTextSchema,
    weekId: identifierSchema,
    lesson: lessonSchema,
  })
  .strict();

export const applicableRuleInputSchema = z
  .object({
    ruleId: identifierSchema,
    ruleVersion: positiveIntegerSchema,
    applicabilityReason: nonEmptyTextSchema,
    generationInstruction: nonEmptyTextSchema,
    validationCriterion: nonEmptyTextSchema,
  })
  .strict();

export const generationModelInputSchema = z
  .object({
    curriculum: curriculumLessonContextSchema,
    progressionContext: z.array(nonEmptyTextSchema),
    totalDurationMinutes: positiveIntegerSchema,
    activityCount: positiveIntegerSchema,
    applicableRules: z.array(applicableRuleInputSchema),
    preservedActivities: z.array(activitySchema),
    localFeedback: z.array(nonEmptyTextSchema),
    editorialTemplateVersion: nonEmptyTextSchema,
  })
  .strict()
  .superRefine((input, context) => {
    const preservedDuration = input.preservedActivities.reduce(
      (total, activity) => total + activity.durationMinutes,
      0,
    );

    if (input.preservedActivities.length > input.activityCount) {
      context.addIssue({
        code: "custom",
        message: "A quantidade preservada não pode superar a quantidade solicitada.",
        path: ["preservedActivities"],
      });
    }

    if (preservedDuration > input.totalDurationMinutes) {
      context.addIssue({
        code: "custom",
        message: "A duração preservada não pode superar a duração total.",
        path: ["preservedActivities"],
      });
    }
  });

export const generationPlanActivitySchema = z
  .object({
    slotIndex: nonNegativeIntegerSchema,
    durationMinutes: positiveIntegerSchema,
    primaryChildAction: nonEmptyTextSchema,
    pedagogicalFunction: nonEmptyTextSchema,
  })
  .strict();

export const generatedActivityProposalSchema = z
  .object({
    slotIndex: nonNegativeIntegerSchema,
    title: nonEmptyTextSchema,
    description: nonEmptyTextSchema,
    durationMinutes: positiveIntegerSchema,
    consideredRuleIds: z.array(identifierSchema),
  })
  .strict();

export const generationModelOutputSchema = z
  .object({
    plan: z
      .object({
        totalDurationMinutes: positiveIntegerSchema,
        slots: z
          .array(generationPlanActivitySchema)
          .min(1)
          .describe("Posições resumidas do plano; não contém as atividades detalhadas."),
      })
      .strict()
      .describe("Resumo do planejamento; contém somente totalDurationMinutes e slots."),
    activities: z
      .array(generatedActivityProposalSchema)
      .min(1)
      .describe("Atividades detalhadas no nível raiz, fora de plan."),
    uncertainties: z
      .array(nonEmptyTextSchema)
      .describe("Incertezas no nível raiz, fora de plan."),
  })
  .strict()
  .superRefine((output, context) => {
    const planBySlot = new Map<number, (typeof output.plan.slots)[number]>();
    let plannedDuration = 0;

    output.plan.slots.forEach((activity, index) => {
      if (planBySlot.has(activity.slotIndex)) {
        context.addIssue({
          code: "custom",
          message: "O plano não pode repetir posições.",
          path: ["plan", "slots", index, "slotIndex"],
        });
      }
      planBySlot.set(activity.slotIndex, activity);
      plannedDuration += activity.durationMinutes;
    });

    if (plannedDuration !== output.plan.totalDurationMinutes) {
      context.addIssue({
        code: "custom",
        message: "A soma do plano deve ser igual à duração total planejada.",
        path: ["plan", "totalDurationMinutes"],
      });
    }

    if (output.activities.length !== output.plan.slots.length) {
      context.addIssue({
        code: "custom",
        message: "O gerador deve entregar uma atividade para cada item do plano.",
        path: ["activities"],
      });
    }

    const generatedSlots = new Set<number>();
    output.activities.forEach((activity, index) => {
      const plannedActivity = planBySlot.get(activity.slotIndex);

      if (generatedSlots.has(activity.slotIndex)) {
        context.addIssue({
          code: "custom",
          message: "As atividades geradas não podem repetir posições.",
          path: ["activities", index, "slotIndex"],
        });
      }
      generatedSlots.add(activity.slotIndex);

      if (!plannedActivity) {
        context.addIssue({
          code: "custom",
          message: "A atividade gerada deve corresponder a uma posição planejada.",
          path: ["activities", index, "slotIndex"],
        });
      } else if (activity.durationMinutes !== plannedActivity.durationMinutes) {
        context.addIssue({
          code: "custom",
          message: "A atividade gerada deve preservar a duração planejada.",
          path: ["activities", index, "durationMinutes"],
        });
      }
    });
  });

export const validationModelInputSchema = z
  .object({
    curriculum: curriculumLessonContextSchema,
    activity: activitySchema,
    relatedActivities: z.array(activitySchema),
    applicableRules: z.array(applicableRuleInputSchema),
    progressionContext: z.array(nonEmptyTextSchema),
  })
  .strict();

export const repairModelInputSchema = z
  .object({
    currentActivity: activitySchema,
    requiredDurationMinutes: positiveIntegerSchema,
    validationFailures: z.array(validationModelResultSchema).min(1),
    feedback: nonEmptyTextSchema.optional(),
    preservedActivities: z.array(activitySchema),
    curriculum: curriculumLessonContextSchema,
    applicableRules: z.array(applicableRuleInputSchema),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.currentActivity.durationMinutes !== input.requiredDurationMinutes) {
      context.addIssue({
        code: "custom",
        message: "O reparo deve exigir a duração da atividade atual.",
        path: ["requiredDurationMinutes"],
      });
    }

    if (input.validationFailures.some((result) => result.status === "passed")) {
      context.addIssue({
        code: "custom",
        message: "A entrada de reparo deve conter apenas falhas ou itens pendentes.",
        path: ["validationFailures"],
      });
    }
  });

export const repairModelOutputSchema = z
  .object({
    activity: generatedActivityProposalSchema,
    uncertainties: z.array(nonEmptyTextSchema),
  })
  .strict();

export type CurriculumLessonContext = z.infer<typeof curriculumLessonContextSchema>;
export type ApplicableRuleInput = z.infer<typeof applicableRuleInputSchema>;
export type GenerationModelInput = z.infer<typeof generationModelInputSchema>;
export type GenerationPlanActivity = z.infer<typeof generationPlanActivitySchema>;
export type GeneratedActivityProposal = z.infer<typeof generatedActivityProposalSchema>;
export type GenerationModelOutput = z.infer<typeof generationModelOutputSchema>;
export type ValidationModelInput = z.infer<typeof validationModelInputSchema>;
export type RepairModelInput = z.infer<typeof repairModelInputSchema>;
export type RepairModelOutput = z.infer<typeof repairModelOutputSchema>;
