import { describe, expect, it } from "vitest";

import rulesData from "../../data/rules.json";
import { ruleSchema } from "./rules";
import { catalogRuleSchema, loadRuleCatalog, selectActiveRules } from "./rules-catalog";

const documentedRuleIds = [
  "CUR-001",
  "PED-001",
  "PED-002",
  "PED-003",
  "PED-004",
  "PED-005",
  "AGE-001",
  "AGE-002",
  "AGE-003",
  "LEX-001",
  "LEX-002",
  "LEX-003",
  "LEX-004",
  "PLAY-001",
  "PLAY-002",
  "PLAY-003",
  "PLAY-004",
  "VAR-001",
  "VAR-002",
  "OPS-001",
  "OPS-002",
  "OPS-003",
  "OPS-004",
  "TIME-001",
  "EDIT-001",
  "EDIT-002",
  "GOV-001",
  "VAL-001",
  "DET-001",
  "DET-002",
  "DET-003",
  "DET-004",
];

describe("catálogo de regras", () => {
  it("carrega as 32 regras versionadas com os IDs documentados", () => {
    const catalog = loadRuleCatalog(rulesData);

    expect(catalog.version).toBe(2);
    expect(catalog.rules).toHaveLength(32);
    expect(catalog.rules.map((rule) => rule.id)).toEqual(documentedRuleIds);
    expect(catalog.rules.every((rule) => rule.version === 1)).toBe(true);
    expect(catalog.rules.every((rule) => rule.applicability.mode.length > 0)).toBe(true);
  });

  it("mantém regras acadêmicas e editoriais distinguíveis pela origem", () => {
    const catalog = loadRuleCatalog(rulesData);
    const rulesById = new Map(catalog.rules.map((rule) => [rule.id, rule]));

    expect(rulesById.get("PED-002")?.origin).toBe("direct");
    expect(rulesById.get("AGE-001")?.origin).toBe("pedagogical_inference");
    expect(rulesById.get("PLAY-002")?.origin).toBe("editorial");
  });

  it("separa explicitamente o descritor do catálogo do contrato persistido", () => {
    const catalogRule = structuredClone(rulesData.rules[0]);
    const persistedRule = Object.fromEntries(
      Object.entries(catalogRule).filter(([field]) => field !== "applicability"),
    );

    expect(catalogRuleSchema.safeParse(catalogRule).success).toBe(true);
    expect(ruleSchema.safeParse(catalogRule).success).toBe(false);
    expect(ruleSchema.safeParse(persistedRule).success).toBe(true);
  });

  it("não seleciona regras arquivadas ou em rascunho para novos lotes", () => {
    const catalog = loadRuleCatalog(rulesData);
    const catalogWithInactiveRules = {
      ...catalog,
      rules: catalog.rules.map((rule) => {
        if (rule.id === "PED-001") {
          return { ...rule, status: "retired" as const };
        }
        if (rule.id === "PED-002") {
          return { ...rule, status: "draft" as const };
        }
        return rule;
      }),
    };

    const selectedIds = selectActiveRules(catalogWithInactiveRules).map((rule) => rule.id);

    expect(selectedIds).not.toContain("PED-001");
    expect(selectedIds).not.toContain("PED-002");
    expect(selectedIds).toHaveLength(30);
  });

  it("recusa IDs duplicados e aponta a segunda ocorrência", () => {
    const duplicatedCatalog = structuredClone(rulesData);
    duplicatedCatalog.rules[1].id = duplicatedCatalog.rules[0].id;

    const result = loadRuleCatalogResult(duplicatedCatalog);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatchObject({
        issues: [
          expect.objectContaining({
            path: ["rules", 1, "id"],
          }),
        ],
      });
    }
  });
});

function loadRuleCatalogResult(input: unknown) {
  try {
    return { success: true as const, data: loadRuleCatalog(input) };
  } catch (error) {
    return { success: false as const, error };
  }
}
