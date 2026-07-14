import { describe, expect, it } from "vitest";

import rulesData from "../../data/rules.json";
import { defineFeedbackScope, promoteFeedbackToRule } from "./feedback-governance";
import { loadRuleCatalog } from "./rules-catalog";

const catalog = loadRuleCatalog(rulesData);
const approvedCandidate = {
  id: "feedback-1",
  reviewActivityId: "atividade-1",
  normalizedText: "Evitar fichas impressas quando a dinâmica puder ser oral.",
  suggestedScope: "rule_candidate" as const,
  status: "approved" as const,
};
const ruleDraft = {
  id: "GOV-002",
  title: "Priorizar dinâmica oral",
  applicabilityCondition: "Aplica-se a atividades que usam fichas impressas.",
  applicability: { mode: "conditional" as const, signals: ["uses_review_feedback" as const] },
  generationInstruction: "Priorize uma dinâmica oral quando a ficha não for necessária.",
  validationCriterion: "A ficha impressa é usada apenas quando necessária ao objetivo.",
  severity: "advisory" as const,
  origin: "editorial" as const,
};

describe("governança de feedback", () => {
  it.each(["regeneration", "session_or_sequence", "rule_candidate"] as const)(
    "define o escopo %s sem promover o feedback automaticamente",
    (scope) => {
      const proposal = defineFeedbackScope({
        id: `feedback-${scope}`,
        reviewActivityId: "atividade-1",
        normalizedText: "Usar uma instrução mais curta.",
        scope,
      });

      expect(proposal).toMatchObject({ suggestedScope: scope, status: "pending" });
      expect(proposal).not.toHaveProperty("createdRuleId");
      expect(proposal).not.toHaveProperty("createdRuleVersion");
    },
  );

  it("recusa promoção sem confirmação explícita", () => {
    expect(() =>
      promoteFeedbackToRule({
        proposal: approvedCandidate,
        rule: ruleDraft,
        catalog,
        confirmed: false,
        confirmedBy: "revisora-poc",
      }),
    ).toThrow();
  });

  it("recusa feedback local, candidato pendente e candidato já promovido", () => {
    const invalidProposals = [
      { ...approvedCandidate, suggestedScope: "regeneration" as const },
      { ...approvedCandidate, status: "pending" as const },
      { ...approvedCandidate, createdRuleId: "GOV-099", createdRuleVersion: 1 },
    ];

    for (const proposal of invalidProposals) {
      expect(() =>
        promoteFeedbackToRule({
          proposal,
          rule: ruleDraft,
          catalog,
          confirmed: true,
          confirmedBy: "revisora-poc",
        }),
      ).toThrow();
    }
  });

  it("cria regra com origem e escopo e uma nova versão do catálogo", () => {
    const result = promoteFeedbackToRule({
      proposal: approvedCandidate,
      rule: ruleDraft,
      catalog,
      confirmed: true,
      confirmedBy: "revisora-poc",
    });

    expect(result.confirmedBy).toBe("revisora-poc");
    expect(result.rule).toMatchObject({
      id: "GOV-002",
      version: 1,
      description: approvedCandidate.normalizedText,
      origin: "editorial",
      status: "active",
      applicability: {
        mode: "conditional",
        signals: ["uses_review_feedback"],
      },
    });
    expect(result.proposal).toMatchObject({
      status: "approved",
      createdRuleId: "GOV-002",
      createdRuleVersion: 1,
    });
    expect(result.catalog.version).toBe(catalog.version + 1);
    expect(result.catalog.rules).toHaveLength(catalog.rules.length + 1);
    expect(result.catalog.rules.at(-1)).toEqual(result.rule);
    expect(catalog.version).toBe(rulesData.version);
    expect(catalog.rules).toHaveLength(rulesData.rules.length);
  });

  it("recusa reutilizar um ID já presente no catálogo", () => {
    expect(() =>
      promoteFeedbackToRule({
        proposal: approvedCandidate,
        rule: { ...ruleDraft, id: catalog.rules[0].id },
        catalog,
        confirmed: true,
        confirmedBy: "revisora-poc",
      }),
    ).toThrow("ID ainda não usado");
  });
});
