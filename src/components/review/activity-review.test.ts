import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { activityReviewItemSchema, type ActivityReviewItem } from "@/domain/review";
import type { ValidationStatus } from "@/domain/rules";

import { ActivityReview, ValidationDetailsModal } from "./activity-review";

function createItem(status: ValidationStatus): ActivityReviewItem {
  const activityId = `atividade-${status}`;

  return activityReviewItemSchema.parse({
    activity: {
      id: activityId,
      batchId: "lote-1",
      logicalActivityId: "atividade-logica-1",
      slotIndex: 0,
      title: "Escuta investigativa",
      description: "A criança identifica o som inicial.",
      durationMinutes: 8,
      status: "draft",
      version: 1,
      generationRunId: "execucao-1",
    },
    ruleReferences: [
      {
        ruleId: "PED-001",
        ruleVersion: 1,
        title: "Ação observável da criança",
        description: "A criança deve realizar uma ação que possa ser observada.",
        origin: "pedagogical_inference",
        sources: [
          {
            id: "fonte-1",
            title: "Referência pedagógica",
            authors: ["Equipe pedagógica"],
            publicationYear: 2026,
          },
        ],
      },
    ],
    validationReport: {
      activityId,
      activityVersion: 1,
      results: [
        {
          id: `resultado-${status}`,
          activityId,
          activityVersion: 1,
          ruleId: "PED-001",
          ruleVersion: 1,
          applicability: "applicable",
          status,
          evidence: "Evidência observada na descrição.",
          explanation: "Explicação registrada pelo avaliador.",
          confidence: 0.8,
          evaluatorOrigin: "system",
          evaluatorId: "avaliador-1",
        },
      ],
      summary: {
        blockingFailures: status === "failed" ? 1 : 0,
        needsHumanReview: status === "needs_review" ? 1 : 0,
      },
      createdAt: "2026-07-14T12:00:00.000Z",
    },
  });
}

function renderModal(status: ValidationStatus) {
  return renderToStaticMarkup(
    createElement(ValidationDetailsModal, {
      item: createItem(status),
      onClose: () => undefined,
      open: true,
    }),
  );
}

describe("detalhes da validação", () => {
  it("renderiza critério amigável e evidência com origem e fonte sob demanda", () => {
    const html = renderModal("passed");

    expect(html).toContain("Ação observável da criança");
    expect(html).toContain("A criança deve realizar uma ação que possa ser observada.");
    expect(html).not.toContain("PED-001");
    expect(html).not.toContain("versão 1");
    expect(html).toContain("Atendido");
    expect(html).toContain("✓");
    expect(html).toContain("Ver evidência");
    expect(html).toContain("Evidência observada na descrição.");
    expect(html).toContain("Inferência pedagógica");
    expect(html).toContain("Referência pedagógica");
    expect(html).toContain("<details");
    expect(html).not.toMatch(/<details[^>]*\sopen(?:=|>)/);
  });

  it("substitui identificadores internos de evidências antigas por texto legível", () => {
    const item = createItem("passed");
    item.validationReport.results[0] = {
      ...item.validationReport.results[0],
      ruleId: "DET-001",
      evidence:
        "A atividade activity-1-v1-abc, versão 1, foi aceita por activitySchema e pertence ao lote batch-abc.",
    };
    item.ruleReferences[0] = {
      ...item.ruleReferences[0],
      ruleId: "DET-001",
      title: "Atender ao padrão da atividade",
      description:
        "A atividade precisa ter todas as informações necessárias para ser salva e associada ao lote correto.",
    };

    const html = renderToStaticMarkup(
      createElement(ValidationDetailsModal, {
        item,
        onClose: () => undefined,
        open: true,
      }),
    );

    expect(html).toContain("Atender ao padrão da atividade");
    expect(html).toContain(
      "A atividade contém todas as informações necessárias e está associada ao lote correto.",
    );
    expect(html).not.toContain("activity-1-v1-abc");
    expect(html).not.toContain("activitySchema");
    expect(html).not.toContain("DET-001");
  });

  it("distingue revisão humana de falha por rótulo e tratamento visual", () => {
    const reviewHtml = renderModal("needs_review");
    const failedHtml = renderModal("failed");

    expect(reviewHtml).toMatch(
      /<li class="[^"]*border-warning bg-warning-soft" data-validation-status="needs_review">/,
    );
    expect(reviewHtml).toContain(">Revisar</span>");
    expect(failedHtml).toMatch(
      /<li class="[^"]*border-danger bg-danger-soft" data-validation-status="failed">/,
    );
    expect(failedHtml).toContain(">Não atendido</span>");
  });
});

describe("resumo da validação na atividade", () => {
  function renderReview(status: ValidationStatus) {
    return renderToStaticMarkup(
      createElement(ActivityReview, {
        state: { status: "ready", items: [createItem(status)] },
      }),
    );
  }

  it("omite o aviso redundante quando a atividade foi validada sem pendências", () => {
    const html = renderReview("passed");

    expect(html).not.toContain("Validação geral");
    expect(html).not.toContain("Validação aprovada");
  });

  it("mantém problemas de validação visíveis para revisão", () => {
    const html = renderReview("failed");

    expect(html).toContain("Validação geral");
    expect(html).toContain("Requer ajustes");
  });
});
