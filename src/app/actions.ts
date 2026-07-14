"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { generationConfigSchema } from "@/domain/generation-config";
import { identifierSchema, positiveIntegerSchema } from "@/domain/shared";
import {
  approveActivity,
  generateAndPersistBatch,
  rejectAndRegenerateActivity,
} from "@/server/generation/integrated-flow";

const completeSelectionSchema = z.object({
  themeId: identifierSchema,
  skillId: identifierSchema,
  objectiveId: identifierSchema,
  weekId: identifierSchema,
  lessonId: identifierSchema,
}).strict();

const generationActionInputSchema = z.object({
  selection: completeSelectionSchema,
  config: generationConfigSchema,
}).strict();

const reviewActionInputSchema = z.object({
  batchId: identifierSchema,
  activityId: identifierSchema,
  activityVersion: positiveIntegerSchema,
  feedback: z.string().optional(),
}).strict();

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
    revalidatePath(`/revisar?lote=${parsed.batchId}`);
    return { ok: true, data: {} };
  } catch (error) {
    return actionError(error);
  }
}

export async function rejectAndRegenerateActivityAction(
  input: unknown,
): Promise<ActionResult<Awaited<ReturnType<typeof rejectAndRegenerateActivity>>>> {
  try {
    const parsed = reviewActionInputSchema.parse(input);
    const result = await rejectAndRegenerateActivity(parsed);
    revalidatePath(`/revisar?lote=${parsed.batchId}`);
    return { ok: true, data: result };
  } catch (error) {
    return actionError(error);
  }
}
