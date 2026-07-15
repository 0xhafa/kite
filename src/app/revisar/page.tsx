import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import {
  ActivityReview,
  type ActivityReviewLoadState,
} from "@/components/review/activity-review";
import {
  defaultAiModelSelection,
  type AiModelSelection,
} from "@/domain/ai-models";
import type { ReviewSessionDecisionHistory } from "@/domain/review-session";
import type { BatchTokenUsage } from "@/domain/usage";
import { loadReviewPageBatch } from "@/server/generation/integrated-flow";

export const metadata: Metadata = {
  title: "Revisar atividades | Kite",
  description: "Revisão pedagógica das atividades geradas e de seus relatórios de validação.",
};

type ReviewPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParameter(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const parameters = await searchParams;
  const requestedState = firstParameter(parameters.estado);
  const batchId = firstParameter(parameters.lote);
  let reviewState: ActivityReviewLoadState;
  let usage: BatchTokenUsage | null = null;
  let decisionHistory: ReviewSessionDecisionHistory = {};
  let modelSelection: AiModelSelection = defaultAiModelSelection;

  if (requestedState === "carregando") {
    reviewState = { status: "loading" };
  } else if (requestedState === "erro") {
    reviewState = {
      status: "error",
      message: "O lote não pôde ser carregado. Volte ao planejamento e tente novamente.",
    };
  } else if (requestedState === "vazio" || !batchId) {
    reviewState = { status: "ready", items: [] };
  } else {
    try {
      const pageBatch = await loadReviewPageBatch(batchId);

      if (pageBatch.status === "missing") {
        reviewState = {
          status: "error",
          message: "O lote informado não existe ou não possui atividades disponíveis.",
        };
      } else if (pageBatch.status === "failed") {
        reviewState = {
          status: "error",
          message: "Não foi possível gerar este lote. Volte ao planejamento e tente novamente.",
        };
      } else if (pageBatch.status === "generating") {
        modelSelection = pageBatch.modelSelection;
        reviewState = {
          status: "generating",
          modelSelection: pageBatch.modelSelection,
        };
      } else {
        const reviewBatch = pageBatch.data;
        reviewState = { status: "ready", items: reviewBatch.items };
        usage = reviewBatch.usage;
        decisionHistory = reviewBatch.decisionHistory;
        modelSelection = reviewBatch.modelSelection;
      }
    } catch {
      reviewState = {
        status: "error",
        message: "Não foi possível reconstruir o lote persistido e seus relatórios.",
      };
    }
  }

  return (
    <AppShell
      initialModelSelection={modelSelection}
      mainClassName="max-w-4xl"
      sectionLabel="Revisão"
    >
      {batchId && reviewState.status === "ready" && reviewState.items.length > 0 ? (
        <Link
          className="mb-6 inline-flex min-h-touch items-center rounded-md font-extrabold text-brand-strong underline decoration-2 underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus"
          href={`/planejar?lote=${encodeURIComponent(batchId)}#aula-selecionada`}
        >
          ← Voltar ao exemplo da aula
        </Link>
      ) : null}
      <ActivityReview
        batchId={batchId}
        decisionHistory={decisionHistory}
        state={reviewState}
        usage={usage}
      />
    </AppShell>
  );
}
