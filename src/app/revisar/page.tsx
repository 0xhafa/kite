import type { Metadata } from "next";
import Link from "next/link";

import {
  ActivityReview,
  type ActivityReviewLoadState,
} from "@/components/review/activity-review";
import { generateMockBatch } from "@/domain/mock-generator";
import { reviewBatchItemsSchema } from "@/domain/review-session";

export const metadata: Metadata = {
  title: "Revisar atividades | Kite",
  description: "Revisão pedagógica das atividades geradas e de seus relatórios de validação.",
};

type ReviewPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const demoItems = createDemoReviewItems();

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const parameters = await searchParams;
  const requestedState = Array.isArray(parameters.estado)
    ? parameters.estado[0]
    : parameters.estado;
  const reviewState = getReviewState(requestedState);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        className="sr-only rounded-md bg-surface px-4 py-3 font-bold focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
        href="#conteudo"
      >
        Ir para o conteúdo
      </a>

      <header className="border-b-2 border-border bg-surface">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link
            className="rounded-md text-xl font-black tracking-[-0.03em] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus"
            href="/"
          >
            Kite
          </Link>
          <span className="rounded-pill bg-neutral-soft px-3 py-2 text-caption font-extrabold uppercase tracking-[0.08em] text-muted">
            Revisão
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14" id="conteudo">
        <ActivityReview state={reviewState} />
      </main>
    </div>
  );
}

function getReviewState(requestedState: string | undefined): ActivityReviewLoadState {
  switch (requestedState) {
    case "carregando":
      return { status: "loading" };
    case "erro":
      return {
        status: "error",
        message: "O lote de demonstração não pôde ser carregado. Volte ao planejamento e tente novamente.",
      };
    case "vazio":
      return { status: "ready", items: [] };
    default:
      return { status: "ready", items: demoItems };
  }
}

function createDemoReviewItems() {
  const batchId = "lote-demonstracao-1";
  const generationRunId = "execucao-mock-1";
  const generatedBatch = generateMockBatch({
    curriculum: {
      themeId: "fonemas",
      curriculumVersion: "fixture-1.0",
      skillId: "identificacao-sonora",
      objectiveId: "som-inicial",
      objectiveName: "Identificar sons iniciais",
      weekId: "semana-1",
      lesson: {
        id: "aula-1",
        number: 1,
        specificObjective: "Identificar o som inicial das palavras",
        content: "som inicial /f/",
      },
    },
    progressionContext: ["A turma já comparou sons presentes no ambiente."],
    totalDurationMinutes: 25,
    activityCount: 3,
    applicableRules: [
      {
        ruleId: "acao-observavel",
        ruleVersion: 1,
        applicabilityReason: "A atividade precisa explicitar a ação da criança.",
        generationInstruction: "Descrever a proposta com um verbo observável.",
        validationCriterion: "A descrição informa uma ação observável da criança.",
      },
    ],
    preservedActivities: [],
    localFeedback: [],
    editorialTemplateVersion: "generation-1",
  });

  return reviewBatchItemsSchema.parse(
    generatedBatch.activities.map((proposal, index) => {
      const activityId = `atividade-demonstracao-${index + 1}`;
      const validationStatus = index === 0 ? "passed" : index === 1 ? "needs_review" : "failed";

      return {
        activity: {
          id: activityId,
          batchId,
          logicalActivityId: `atividade-logica-${index + 1}`,
          slotIndex: proposal.slotIndex,
          title: proposal.title,
          description: proposal.description,
          durationMinutes: proposal.durationMinutes,
          status: "draft",
          version: 1,
          generationRunId,
        },
        ruleReferences: [
          {
            ruleId: "acao-observavel",
            ruleVersion: 1,
            title: "Ação observável da criança",
            origin: "pedagogical_inference",
            sources: [
              {
                id: "fonte-diretrizes-kite",
                title: "Diretrizes pedagógicas da POC Kite",
                authors: ["Equipe Kite"],
                publicationYear: 2026,
                locator: "Critério de demonstração: ação observável da criança",
              },
            ],
          },
        ],
        validationReport: {
          activityId,
          activityVersion: 1,
          results: [
            {
              id: `resultado-demonstracao-${index + 1}`,
              activityId,
              activityVersion: 1,
              ruleId: "acao-observavel",
              ruleVersion: 1,
              applicability: "applicable",
              status: validationStatus,
              evidence:
                validationStatus === "passed"
                  ? "A descrição usa o verbo observável “observa”."
                  : validationStatus === "needs_review"
                    ? "A descrição explicita uma ação, mas não define como observar a resposta da criança."
                    : "A ação principal aparece de forma genérica e sem um comportamento verificável.",
              explanation:
                validationStatus === "passed"
                  ? "A ação esperada da criança está explícita na descrição."
                  : validationStatus === "needs_review"
                    ? "A ação está descrita, mas sua adequação precisa de decisão pedagógica."
                    : "A descrição precisa tornar a ação principal mais verificável.",
              confidence: validationStatus === "needs_review" ? 0.62 : 0.9,
              evaluatorOrigin: "system",
              evaluatorId: "validador-mock-1",
            },
          ],
          summary: {
            blockingFailures: validationStatus === "failed" ? 1 : 0,
            needsHumanReview: validationStatus === "needs_review" ? 1 : 0,
          },
          createdAt: "2026-07-14T13:20:10-03:00",
        },
      };
    }),
  );
}
