import { z } from "zod";

import { ruleSchema, type Rule } from "./rules";
import { positiveIntegerSchema } from "./shared";

export const ruleCatalogSchema = z
  .object({
    version: positiveIntegerSchema,
    rules: z.array(ruleSchema).min(1),
  })
  .strict()
  .superRefine((catalog, context) => {
    const identifiers = new Map<string, number>();

    catalog.rules.forEach((rule, index) => {
      const previousIndex = identifiers.get(rule.id);

      if (previousIndex !== undefined) {
        context.addIssue({
          code: "custom",
          message: `ID de regra duplicado; primeira ocorrência em rules.${previousIndex}.id`,
          path: ["rules", index, "id"],
        });
        return;
      }

      identifiers.set(rule.id, index);
    });
  });

export type RuleCatalog = z.infer<typeof ruleCatalogSchema>;

/** Valida um seed de regras na fronteira e o expõe no contrato canônico. */
export function loadRuleCatalog(input: unknown): RuleCatalog {
  return ruleCatalogSchema.parse(input);
}

/** Seleciona somente regras ativas, elegíveis para compor novos lotes. */
export function selectActiveRules(catalog: RuleCatalog): Rule[] {
  return catalog.rules.filter((rule) => rule.status === "active");
}
