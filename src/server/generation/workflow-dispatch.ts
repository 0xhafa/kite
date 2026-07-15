import { start } from "workflow/api";

import {
  createPersistedGenerationRequest,
  markGenerationBatchFailed,
  type GenerationRequestInput,
} from "./integrated-flow";
import { generateBatchWorkflow } from "@/workflows/generate-batch";

export function shouldUseDurableGenerationWorkflow(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return environment.KITE_ASYNC_GENERATION === "1" || environment.VERCEL === "1";
}

export async function startDurableGenerationWorkflow(
  input: GenerationRequestInput,
): Promise<string> {
  const persistedInput = await createPersistedGenerationRequest(input);

  try {
    await start(generateBatchWorkflow, [persistedInput]);
    return persistedInput.batchId;
  } catch (error) {
    await markGenerationBatchFailed(persistedInput.batchId).catch(() => undefined);
    throw error;
  }
}
