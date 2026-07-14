import { describe, expect, it } from "vitest";

import rulesData from "../../data/rules.json";
import {
  activityApplicabilityContextSchema,
  evaluateRuleApplicability,
  evaluateRuleCatalogApplicability,
  selectApplicableRuleInputs,
} from "./applicability";
import { loadRuleCatalog } from "./rules-catalog";

const catalog = loadRuleCatalog(rulesData);

describe("motor de aplicabilidade", () => {
  it("mantém regras universais aplicáveis mesmo sem sinais condicionais", () => {
    const rule = getRule("CUR-001");

    expect(evaluateRuleApplicability(rule, { signals: [] })).toEqual({
      ruleId: "CUR-001",
      ruleVersion: 1,
      applicability: "applicable",
      applicabilityReason: "A regra CUR-001 é aplicável a toda atividade.",
      matchedSignals: [],
    });
  });

  it("retorna os dois resultados possíveis para uma regra condicional", () => {
    const rule = getRule("PED-005");

    expect(evaluateRuleApplicability(rule, { signals: [] })).toMatchObject({
      applicability: "not_applicable",
      matchedSignals: [],
    });
    expect(
      evaluateRuleApplicability(rule, { signals: ["introduces_new_phoneme"] }),
    ).toMatchObject({
      applicability: "applicable",
      matchedSignals: ["introduces_new_phoneme"],
    });
  });

  it("ativa a modelagem articulatória quando há introdução de novo fonema", () => {
    const decisions = evaluateRuleCatalogApplicability(catalog, {
      signals: ["introduces_new_phoneme"],
    });

    expect(findDecision(decisions, "PED-005")).toMatchObject({
      applicability: "applicable",
      matchedSignals: ["introduces_new_phoneme"],
    });
  });

  it("ativa a restrição lexical da síntese completa e exclui a de análise inicial", () => {
    const decisions = evaluateRuleCatalogApplicability(catalog, {
      signals: ["uses_words", "full_phonemic_synthesis"],
    });

    expect(findDecision(decisions, "LEX-003")?.applicability).toBe("applicable");
    expect(findDecision(decisions, "LEX-004")?.applicability).toBe("not_applicable");
  });

  it("ativa a permissão lexical da análise inicial e exclui a de síntese completa", () => {
    const decisions = evaluateRuleCatalogApplicability(catalog, {
      signals: ["uses_words", "initial_sound_or_syllable_analysis"],
    });

    expect(findDecision(decisions, "LEX-003")?.applicability).toBe("not_applicable");
    expect(findDecision(decisions, "LEX-004")?.applicability).toBe("applicable");
  });

  it("recusa um contexto que declara operações lexicais conflitantes", () => {
    const result = activityApplicabilityContextSchema.safeParse({
      signals: ["full_phonemic_synthesis", "initial_sound_or_syllable_analysis"],
    });

    expect(result.success).toBe(false);
  });

  it("seleciona só regras ativas e aplicáveis no contrato dos modelos", () => {
    const catalogWithRetiredRule = {
      ...catalog,
      rules: catalog.rules.map((rule) =>
        rule.id === "PED-005" ? { ...rule, status: "retired" as const } : rule,
      ),
    };

    const inputs = selectApplicableRuleInputs(catalogWithRetiredRule, {
      signals: ["introduces_new_phoneme", "full_phonemic_synthesis"],
    });
    const inputIds = inputs.map((input) => input.ruleId);

    expect(inputIds).toContain("LEX-003");
    expect(inputIds).not.toContain("LEX-004");
    expect(inputIds).not.toContain("PED-005");

    const lexicalRule = getRule("LEX-003");
    expect(inputs.find((input) => input.ruleId === "LEX-003")).toEqual({
      ruleId: lexicalRule.id,
      ruleVersion: lexicalRule.version,
      applicabilityReason:
        "A regra LEX-003 é aplicável porque o contexto informa síntese fonêmica completa.",
      generationInstruction: lexicalRule.generationInstruction,
      validationCriterion: lexicalRule.validationCriterion,
    });
  });

  it("reserva regras estruturais ao contexto de validação determinística", () => {
    const generationInputs = selectApplicableRuleInputs(catalog, {
      signals: ["multiple_activities"],
    });
    const deterministicDecisions = evaluateRuleCatalogApplicability(catalog, {
      signals: [
        "deterministic_validation",
        "deterministic_validation_multiple_activities",
      ],
    });

    expect(generationInputs.some((input) => input.ruleId.startsWith("DET-"))).toBe(false);
    expect(
      deterministicDecisions
        .filter((decision) => decision.ruleId.startsWith("DET-"))
        .map((decision) => decision.applicability),
    ).toEqual(["applicable", "applicable", "applicable", "applicable"]);
  });
});

function getRule(ruleId: string) {
  const rule = catalog.rules.find((candidate) => candidate.id === ruleId);

  if (!rule) {
    throw new Error(`Regra ausente do fixture: ${ruleId}.`);
  }

  return rule;
}

function findDecision(
  decisions: ReturnType<typeof evaluateRuleCatalogApplicability>,
  ruleId: string,
) {
  return decisions.find((decision) => decision.ruleId === ruleId);
}
