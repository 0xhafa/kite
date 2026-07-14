import type { z } from "zod";

import { curriculumSchema, type Curriculum } from "./curriculum";

type CurriculumIssue = z.ZodError["issues"][number];

function formatPath(path: CurriculumIssue["path"]): string {
  if (path.length === 0) {
    return "raiz do documento";
  }

  return path.reduce<string>((formatted, segment) => {
    if (typeof segment === "number") {
      return `${formatted}[${segment}]`;
    }

    const key = String(segment);
    return formatted ? `${formatted}.${key}` : key;
  }, "");
}

function describeIssue(issue: CurriculumIssue): string {
  if (issue.code === "custom") {
    return issue.message;
  }

  if (issue.code === "invalid_type") {
    return "campo ausente ou com tipo incompatível";
  }

  if (issue.code === "too_small") {
    return "valor vazio ou abaixo do mínimo permitido";
  }

  return "valor incompatível com o contrato curricular";
}

export class CurriculumAdapterError extends Error {
  readonly name = "CurriculumAdapterError";

  constructor(readonly issues: z.ZodError["issues"]) {
    const firstIssue = issues[0];
    const firstProblem = firstIssue
      ? ` Primeiro problema em “${formatPath(firstIssue.path)}”: ${describeIssue(firstIssue)}.`
      : "";

    super(
      `O JSON curricular é inválido. Revise ${issues.length} ${
        issues.length === 1 ? "problema estrutural" : "problemas estruturais"
      }.${firstProblem}`,
    );
  }
}

/** Valida a entrada curricular na fronteira e a expõe no contrato canônico. */
export function adaptCurriculum(input: unknown): Curriculum {
  const result = curriculumSchema.safeParse(input);

  if (!result.success) {
    throw new CurriculumAdapterError(result.error.issues);
  }

  return result.data;
}
