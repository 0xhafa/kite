import { readFileSync } from "node:fs";
import { join } from "node:path";

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

const contractFiles = {
  generation: "generation-contract.md",
  repair: "repair-contract.md",
  validation: "validation-contract.md",
} as const satisfies Record<AiOperation, string>;

const roleInstructions = {
  generation:
    "Abstraia os invariantes pedagógicos do currículo e crie um lote original, sem usar a aula de referência como molde, sem modificar o conteúdo ensinado e sem declarar regras como atendidas.",
  repair:
    "Substitua somente a atividade indicada por uma dinâmica estruturalmente diferente, preservando sua posição e duração e sem alterar as atividades preservadas.",
  validation:
    "Avalie a atividade sem reescrevê-la. Registre evidência real por regra e use needs_review quando não houver confiança.",
} as const satisfies Record<AiOperation, string>;

function readContract(operation: AiOperation): string {
  return readFileSync(
    join(process.cwd(), "prompts", contractFiles[operation]),
    "utf8",
  ).trim();
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

export function createRepairCorrectionMessage(
  details: readonly string[],
): AiMessage {
  return {
    role: "user",
    content: [
      "A resposta anterior não atendeu ao contrato de reparo.",
      "Corrija somente os problemas listados e devolva um novo objeto JSON completo, sem markdown ou comentários.",
      ...details.map((detail) => `- ${detail}`),
    ].join("\n"),
  };
}

export function createValidationMessages(
  input: ValidationModelInput,
): AiMessage[] {
  return createMessages("validation", input);
}
