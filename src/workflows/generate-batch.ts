import { revalidateTag } from "next/cache";

import { REVIEWED_ACTIVITY_LIBRARY_CACHE_TAG } from "@/server/generation/cache";
import {
  generateArtifactsForPersistedBatch,
  markGenerationBatchFailed,
  persistInitialGenerationArtifacts,
  type PersistedGenerationRequest,
} from "@/server/generation/integrated-flow";
import type { InitialGenerationArtifacts } from "@/server/generation/pipeline";

export type GenerateBatchWorkflowResult = {
  batchId: string;
  status: "ready_for_review" | "failed";
};

export async function generateBatchWorkflow(
  input: PersistedGenerationRequest,
): Promise<GenerateBatchWorkflowResult> {
  "use workflow";

  try {
    const artifacts = await generateBatchArtifactsStep(input);
    await persistBatchArtifactsStep(artifacts);
    return { batchId: input.batchId, status: "ready_for_review" };
  } catch {
    await markBatchFailedStep(input.batchId);
    return { batchId: input.batchId, status: "failed" };
  }
}

async function generateBatchArtifactsStep(
  input: PersistedGenerationRequest,
): Promise<InitialGenerationArtifacts> {
  "use step";
  return generateArtifactsForPersistedBatch(input);
}

async function persistBatchArtifactsStep(
  artifacts: InitialGenerationArtifacts,
): Promise<void> {
  "use step";
  await persistInitialGenerationArtifacts(artifacts);
  revalidateTag(REVIEWED_ACTIVITY_LIBRARY_CACHE_TAG, { expire: 0 });
}

async function markBatchFailedStep(batchId: string): Promise<void> {
  "use step";
  await markGenerationBatchFailed(batchId);
}
