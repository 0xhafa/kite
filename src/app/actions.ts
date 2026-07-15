"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

import { aiModelSelectionSchema } from "@/domain/ai-models";
import { generationConfigSchema } from "@/domain/generation-config";
import { completeCurriculumSelectionSchema } from "@/domain/curriculum-navigation";
import { identifierSchema, positiveIntegerSchema } from "@/domain/shared";
import {
  approveActivity,
  deletePersistedBatch,
  generateAndPersistBatch,
  loadGenerationBatchStatus,
  rejectActivity,
  rejectAndRegenerateActivity,
} from "@/server/generation/integrated-flow";
import { REVIEWED_ACTIVITY_LIBRARY_CACHE_TAG } from "@/server/generation/cache";
import {
  shouldUseDurableGenerationWorkflow,
  startDurableGenerationWorkflow,
} from "@/server/generation/workflow-dispatch";

const generationActionInputSchema = z.object({
  selection: completeCurriculumSelectionSchema,
  config: generationConfigSchema,
}).strict();

const generationStatusActionInputSchema = z.object({
  batchId: identifierSchema,
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

const deleteBatchActionInputSchema = z.object({
  batchId: identifierSchema,
  confirmation: z.literal("deletar"),
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

function invalidateReviewedActivityLibrary(): void {
  updateTag(REVIEWED_ACTIVITY_LIBRARY_CACHE_TAG);
}

export async function generateBatchAction(
  input: unknown,
): Promise<ActionResult<{ batchId: string }>> {
  try {
    const parsed = generationActionInputSchema.parse(input);
    const batchId = shouldUseDurableGenerationWorkflow()
      ? await startDurableGenerationWorkflow(parsed)
      : await generateAndPersistBatch(parsed);
    invalidateReviewedActivityLibrary();
    revalidatePath("/");
    revalidatePath("/atividades");
    revalidatePath("/trilha");
    return { ok: true, data: { batchId } };
  } catch (error) {
    return actionError(error);
  }
}

export async function getGenerationStatusAction(
  input: unknown,
): Promise<ActionResult<{ status: Awaited<ReturnType<typeof loadGenerationBatchStatus>> }>> {
  try {
    const parsed = generationStatusActionInputSchema.parse(input);
    const status = await loadGenerationBatchStatus(parsed.batchId);
    return { ok: true, data: { status } };
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
    invalidateReviewedActivityLibrary();
    revalidatePath("/");
    revalidatePath("/atividades");
    revalidatePath("/revisar");
    revalidatePath("/trilha");
    return { ok: true, data: {} };
  } catch (error) {
    return actionError(error);
  }
}

export async function rejectActivityAction(
  input: unknown,
): Promise<ActionResult<Record<string, never>>> {
  try {
    const parsed = reviewActionInputSchema.parse(input);
    await rejectActivity(parsed);
    invalidateReviewedActivityLibrary();
    revalidatePath("/");
    revalidatePath("/atividades");
    revalidatePath("/revisar");
    revalidatePath("/trilha");
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
    invalidateReviewedActivityLibrary();
    revalidatePath("/");
    revalidatePath("/atividades");
    revalidatePath("/revisar");
    revalidatePath("/trilha");
    return { ok: true, data: result };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteBatchAction(
  input: unknown,
): Promise<ActionResult<{ batchId: string }>> {
  try {
    const parsed = deleteBatchActionInputSchema.parse(input);
    await deletePersistedBatch(parsed.batchId);
    invalidateReviewedActivityLibrary();
    revalidatePath("/");
    revalidatePath("/atividades");
    revalidatePath("/planejar");
    revalidatePath("/revisar");
    revalidatePath("/trilha");
    return { ok: true, data: { batchId: parsed.batchId } };
  } catch (error) {
    return actionError(error);
  }
}
