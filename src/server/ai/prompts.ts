import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type {
  GenerationModelInput,
  RepairModelInput,
  ValidationModelInput,
} from "@/domain/model-contracts";

export type AiOperation = "generation" | "repair" | "validation";

export type AiMessage = {
  role: "system" | "user";
  content: string;
};

const contractPaths = {
  generation: "prompts/generation-contract.md",
  repair: "prompts/repair-contract.md",
  validation: "prompts/validation-contract.md",
} as const satisfies Record<AiOperation, string>;

const roleInstructions = {
  generation:
    "Planeje e gere o lote sem modificar o currículo recebido e sem declarar regras como atendidas.",
  repair:
    "Substitua somente a atividade indicada, preservando sua posição e duração e sem alterar as atividades preservadas.",
  validation:
    "Avalie a atividade sem reescrevê-la. Registre evidência real por regra e use needs_review quando não houver confiança.",
} as const satisfies Record<AiOperation, string>;

function readContract(operation: AiOperation): string {
  return readFileSync(resolve(process.cwd(), contractPaths[operation]), "utf8").trim();
}

function createMessages(operation: AiOperation, input: unknown): AiMessage[] {
  return [
    {
      role: "system",
      content: [
        "Você integra o pipeline pedagógico do projeto Fonemas.",
        roleInstructions[operation],
        "Responda somente com um objeto JSON que obedeça exatamente ao contrato, sem markdown ou comentários adicionais.",
        readContract(operation),
      ].join("\n\n"),
    },
    {
      role: "user",
      content: JSON.stringify(input),
    },
  ];
}

export function createGenerationMessages(
  input: GenerationModelInput,
): AiMessage[] {
  return createMessages("generation", input);
}

export function createRepairMessages(input: RepairModelInput): AiMessage[] {
  return createMessages("repair", input);
}

export function createValidationMessages(
  input: ValidationModelInput,
): AiMessage[] {
  return createMessages("validation", input);
}
