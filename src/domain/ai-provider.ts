import type {
  GenerationModelInput,
  GenerationModelOutput,
  RepairModelInput,
  RepairModelOutput,
  ValidationModelInput,
} from "./model-contracts";
import type { ValidationModelOutput } from "./rules";

export interface GenerationProvider {
  generate(input: GenerationModelInput): Promise<GenerationModelOutput>;
}

export interface RepairProvider {
  repair(input: RepairModelInput): Promise<RepairModelOutput>;
}

export interface SemanticValidationProvider {
  evaluate(input: ValidationModelInput): Promise<ValidationModelOutput>;
}

export interface AiProvider
  extends GenerationProvider,
    RepairProvider,
    SemanticValidationProvider {}
