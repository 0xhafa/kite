"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { aiModelSelectionSchema } from "@/domain/ai-models";
import { generationConfigSchema } from "@/domain/generation-config";
import { completeCurriculumSelectionSchema } from "@/domain/curriculum-navigation";
import { identifierSchema, positiveIntegerSchema } from "@/domain/shared";
import {
  approveActivity,
  generateAndPersistBatch,
  rejectAndRegenerateActivity,
} from "@/server/generation/integrated-flow";

const generationActionInputSchema = z.object({
  selection: completeCurriculumSelectionSchema,
  config: generationConfigSchema,
}).strict();

const reviewActionInputSchema = z.object({
  batchId: identifierSchema,
  activityId: identifierSchema,
  activityVersion: positiveIntegerSchema,
  feedback: z.string().optional(),
}).strict();

const regenerationActionInputSchema = reviewActionInputSchema.extend({
  modelSelection: aiModelSelectionSchema,
});

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

function actionError(error: unknown): { ok: false; message: string } {
  return {
    ok: false,
    message:
      error instanceof Error
        ? error.message
        : "Não foi possível concluir a operação. Tente novamente.",
  };
}

export async function generateBatchAction(
  input: unknown,
): Promise<ActionResult<{ batchId: string }>> {
  try {
    const parsed = generationActionInputSchema.parse(input);
    const batchId = await generateAndPersistBatch(parsed);
    revalidatePath("/");
    revalidatePath("/atividades");
    return { ok: true, data: { batchId } };
  } catch (error) {
    return actionError(error);
  }
}

export async function approveActivityAction(
  input: unknown,
): Promise<ActionResult<Record<string, never>>> {
  try {
    const parsed = reviewActionInputSchema.parse(input);
    await approveActivity(parsed);
    revalidatePath("/");
    revalidatePath("/atividades");
    revalidatePath("/revisar");
    return { ok: true, data: {} };
  } catch (error) {
    return actionError(error);
  }
}

export async function rejectAndRegenerateActivityAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof rejectAndRegenerateActivity>>>> {
  try {
    const parsed = regenerationActionInputSchema.parse(input);
    const result = await rejectAndRegenerateActivity(parsed);
    revalidatePath("/");
    revalidatePath("/atividades");
    revalidatePath("/revisar");
    return { ok: true, data: result };
  } catch (error) {
    return actionError(error);
  }
}
