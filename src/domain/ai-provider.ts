import type {
  GenerationModelInput,
  GenerationModelOutput,
  RepairModelInput,
  RepairModelOutput,
  ValidationModelInput,
} from "./model-contracts";
import type { ReasoningEffort } from "./ai-models";
import type { ValidationModelOutput } from "./rules";
import type { JsonObject } from "./shared";

export type AiRunMetadata = {
  provider: string;
  model: string;
  reasoningEffort?: ReasoningEffort;
  rawUsage?: JsonObject;
  latencyMilliseconds: number;
};

export type AiProviderResult<TOutput> = {
  output: TOutput;
  run: AiRunMetadata;
};

export interface GenerationProvider {
  generate(
    input: GenerationModelInput,
  ): Promise<AiProviderResult<GenerationModelOutput>>;
}

export interface RepairProvider {
  repair(
    input: RepairModelInput,
  ): Promise<AiProviderResult<RepairModelOutput>>;
}

export interface SemanticValidationProvider {
  evaluate(
    input: ValidationModelInput,
  ): Promise<AiProviderResult<ValidationModelOutput>>;
}

export interface AiProvider
  extends GenerationProvider,
    RepairProvider,
    SemanticValidationProvider {}
