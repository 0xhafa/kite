"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  approveActivityAction,
  rejectAndRegenerateActivityAction,
} from "@/app/actions";
import { useOptionalAiSettings } from "@/components/ai/ai-settings";
import { Badge, Button, Card, Modal, Progress } from "@/components/ui";
import { parseActivityDescription } from "@/domain/activity-description";
import { defaultAiModelSelection } from "@/domain/ai-models";
import type { ActivityReviewItem, ReviewRuleReference } from "@/domain/review";
import {
  createReviewSession,
  decideCurrentReviewItem,
  getCurrentReviewItem,
  getReviewProgress,
  goToReviewItem,
  type ReviewSessionDecisionHistory,
} from "@/domain/review-session";
import type { ValidationResult, ValidationStatus } from "@/domain/rules";
import type { BatchTokenUsage } from "@/domain/usage";

import { BatchUsageSummary } from "./batch-usage-summary";

export type ActivityReviewLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: readonly ActivityReviewItem[] };

export type ActivityReviewProps = {
  batchId?: string;
  decisionHistory?: ReviewSessionDecisionHistory;
  state: ActivityReviewLoadState;
  usage?: BatchTokenUsage | null;
};

type DecisionFeedback = {
  message: string;
  tone: "success" | "danger";
};

export function ActivityReview({
  batchId,
  decisionHistory = {},
  state,
  usage = null,
}: ActivityReviewProps) {
  if (state.status === "loading") {
    return <ReviewLoadingState />;
  }

  if (state.status === "error") {
    return <ReviewErrorState message={state.message} />;
  }

  if (state.items.length === 0) {
    return (
      <>
        <ReviewEmptyState />
        <div className="relative mt-4 flex justify-end">
          <BatchUsageSummary usage={usage} />
        </div>
      </>
    );
  }

  return (
    <ReadyActivityReview
      batchId={batchId ?? state.items[0].activity.batchId}
      decisionHistory={decisionHistory}
      items={state.items}
      usage={usage}
    />
  );
}

function ReadyActivityReview({
  batchId,
  decisionHistory,
  items,
  usage,
}: {
  batchId: string;
  decisionHistory: ReviewSessionDecisionHistory;
  items: readonly ActivityReviewItem[];
  usage: BatchTokenUsage | null;
}) {
  const aiSettings = useOptionalAiSettings();
  const [session, setSession] = useState(() => createReviewSession(items, decisionHistory));
  const [currentUsage, setCurrentUsage] = useState(usage);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [decisionFeedback, setDecisionFeedback] = useState<DecisionFeedback | null>(null);
  const [feedbackByActivity, setFeedbackByActivity] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const activityHeadingRef = useRef<HTMLHeadingElement>(null);
  const completionHeadingRef = useRef<HTMLHeadingElement>(null);
  const closeDetails = useCallback(() => setDetailsOpen(false), []);
  const currentItem = getCurrentReviewItem(session);
  const progress = getReviewProgress(session);
  const currentIndex = session.currentIndex;
  const feedback = currentItem ? feedbackByActivity[currentItem.activity.id] ?? "" : "";

  useEffect(() => {
    if (currentItem) {
      activityHeadingRef.current?.focus();
    } else {
      completionHeadingRef.current?.focus();
    }
  }, [currentItem]);

  async function approve() {
    if (!currentItem) {
      return;
    }

    const title = currentItem.activity.title;
    setActionError(null);
    setActionPending(true);
    const result = await approveActivityAction({
      batchId,
      activityId: currentItem.activity.id,
      activityVersion: currentItem.activity.version,
      feedback,
    });
    setActionPending(false);

    if (!result.ok) {
      setActionError(result.message);
      return;
    }

    setSession((currentSession) =>
      decideCurrentReviewItem(currentSession, "approved", feedback),
    );
    setDecisionFeedback({
      message: `“${title}” foi aprovada.`,
      tone: "success",
    });
    setFeedbackByActivity((currentFeedback) => {
      const nextFeedback = { ...currentFeedback };
      delete nextFeedback[currentItem.activity.id];
      return nextFeedback;
    });
    setDetailsOpen(false);
  }

  async function rejectAndRegenerate() {
    if (!currentItem) return;

    const rejectedItem = currentItem;
    setActionError(null);
    setActionPending(true);
    const result = await rejectAndRegenerateActivityAction({
      batchId,
      activityId: rejectedItem.activity.id,
      activityVersion: rejectedItem.activity.version,
      feedback,
      modelSelection: aiSettings?.selection ?? defaultAiModelSelection,
    });
    setActionPending(false);

    if (!result.ok) {
      setActionError(result.message);
      return;
    }

    setSession((currentSession) => {
      const replacedIndex = currentSession.items.findIndex(
        (item) => item.activity.id === rejectedItem.activity.id,
      );
      const nextItems = currentSession.items.map((item) =>
        item.activity.id === rejectedItem.activity.id ? result.data.item : item,
      );
      const nextHistory = { ...currentSession.decisionHistory };
      delete nextHistory[rejectedItem.activity.id];
      const nextSession = createReviewSession(nextItems, nextHistory);
      return replacedIndex >= 0 ? goToReviewItem(nextSession, replacedIndex) : nextSession;
    });
    setCurrentUsage(result.data.usage);
    setDecisionFeedback({
      message: `“${rejectedItem.activity.title}” foi rejeitada e substituída apenas nesta posição.`,
      tone: "danger",
    });
    setFeedbackByActivity((currentFeedback) => {
      const nextFeedback = { ...currentFeedback };
      delete nextFeedback[rejectedItem.activity.id];
      return nextFeedback;
    });
    setDetailsOpen(false);
  }

  function navigateTo(index: number) {
    setSession((currentSession) => goToReviewItem(currentSession, index));
    setActionError(null);
    setDecisionFeedback(null);
    setDetailsOpen(false);
  }

  function updateFeedback(value: string) {
    if (!currentItem) return;

    setFeedbackByActivity((currentFeedback) => ({
      ...currentFeedback,
      [currentItem.activity.id]: value,
    }));
  }

  const totalDurationMinutes = session.items.reduce(
    (total, item) => total + item.activity.durationMinutes,
    0,
  );

  return (
    <section aria-labelledby="titulo-revisao">
      <Badge tone="info">Etapa 3 · Revisão</Badge>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="text-title font-black tracking-[-0.03em] sm:text-display"
            id="titulo-revisao"
          >
            Revise o lote
          </h1>
          <p className="mt-3 max-w-2xl text-lead font-medium text-muted">
            Leia uma proposta por vez e registre sua decisão pedagógica.
          </p>
        </div>
        <div className="relative flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start">
          <p className="font-extrabold text-muted">
            {progress.reviewed} de {progress.total} revisadas · {totalDurationMinutes} min
          </p>
          <BatchUsageSummary usage={currentUsage} />
        </div>
      </div>

      <Card className="mt-7" padding="sm" raised={false} tone="outlined">
        <Progress
          aria-live="polite"
          label="Progresso da revisão"
          max={progress.total}
          showValue={false}
          value={progress.reviewed}
        />
        <ul
          aria-label="Resumo das decisões"
          className="mt-4 grid grid-cols-3 gap-2 text-center"
        >
          <ProgressCount label="Aprovadas" tone="text-success" value={progress.approved} />
          <ProgressCount label="Rejeitadas" tone="text-danger" value={progress.rejected} />
          <ProgressCount label="Pendentes" tone="text-muted" value={progress.pending} />
        </ul>
      </Card>

      {decisionFeedback ? (
        <div
          className={`mt-5 rounded-md px-4 py-3 text-sm font-extrabold ${
            decisionFeedback.tone === "success"
              ? "bg-success-soft text-success"
              : "bg-danger-soft text-danger"
          }`}
          role="status"
        >
          {decisionFeedback.message}
        </div>
      ) : null}

      {actionError ? (
        <div className="mt-5 rounded-md bg-danger-soft px-4 py-3 text-sm font-extrabold text-danger" role="alert">
          {actionError}
        </div>
      ) : null}

      {currentItem ? (
        <ActivityCard
          busy={actionPending}
          feedback={feedback}
          item={currentItem}
          onApprove={approve}
          onFeedbackChange={updateFeedback}
          onNext={
            currentIndex !== null && currentIndex < session.items.length - 1
              ? () => navigateTo(currentIndex + 1)
              : undefined
          }
          onOpenDetails={() => setDetailsOpen(true)}
          onPrevious={
            currentIndex !== null && currentIndex > 0
              ? () => navigateTo(currentIndex - 1)
              : undefined
          }
          onReject={rejectAndRegenerate}
          position={(currentIndex ?? 0) + 1}
          titleRef={activityHeadingRef}
          total={progress.total}
        />
      ) : (
        <ReviewCompleteState
          approved={progress.approved}
          headingRef={completionHeadingRef}
          onReviewAgain={() => navigateTo(0)}
          rejected={progress.rejected}
          total={progress.total}
        />
      )}

      {currentItem ? (
        <ValidationDetailsModal
          item={currentItem}
          onClose={closeDetails}
          open={detailsOpen}
        />
      ) : null}
    </section>
  );
}

function ProgressCount({
  label,
  tone,
  value,
}: {
  label: string;
  tone: string;
  value: number;
}) {
  return (
    <li className="rounded-md bg-neutral-soft px-2 py-3">
      <strong className={`block text-xl font-black ${tone}`}>{value}</strong>
      <span className="mt-1 block text-xs font-extrabold text-muted sm:text-sm">{label}</span>
    </li>
  );
}

function ActivityCard({
  busy,
  feedback,
  item,
  onApprove,
  onFeedbackChange,
  onNext,
  onOpenDetails,
  onPrevious,
  onReject,
  position,
  titleRef,
  total,
}: {
  busy: boolean;
  feedback: string;
  item: ActivityReviewItem;
  onApprove: () => void;
  onFeedbackChange: (feedback: string) => void;
  onNext?: () => void;
  onOpenDetails: () => void;
  onPrevious?: () => void;
  onReject: () => void;
  position: number;
  titleRef: React.RefObject<HTMLHeadingElement | null>;
  total: number;
}) {
  const validationIssue = getValidationIssuePresentation(item);
  const feedbackHelpId = `ajuda-feedback-${item.activity.id}`;

  return (
    <Card className="mt-6 overflow-hidden" padding="none">
      <article aria-labelledby={`atividade-${item.activity.id}`} className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.08em] text-muted">
              Atividade {position} de {total}
            </p>
            <p className="mt-1 text-xs font-bold text-muted" data-testid="current-activity-version">
              Versão {item.activity.version}
            </p>
          </div>
          <span className="rounded-pill bg-brand-soft px-3 py-2 text-sm font-black text-brand-strong">
            {item.activity.durationMinutes} min
          </span>
        </div>

        <h2
          className="mt-5 text-2xl font-black tracking-[-0.02em] focus:outline-none sm:text-3xl"
          id={`atividade-${item.activity.id}`}
          ref={titleRef}
          tabIndex={-1}
        >
          {item.activity.title}
        </h2>
        <ActivityDescription description={item.activity.description} />

        {total > 1 ? (
          <nav
            aria-label="Navegação entre atividades"
            className="mt-6 flex items-center justify-between gap-3 border-t-2 border-border pt-5"
          >
            <Button
              aria-label="Atividade anterior"
              disabled={busy || !onPrevious}
              onClick={onPrevious}
              size="sm"
              variant="secondary"
            >
              ← Anterior
            </Button>
            <span className="text-sm font-extrabold text-muted" aria-live="polite">
              {position} de {total}
            </span>
            <Button
              aria-label="Próxima atividade"
              disabled={busy || !onNext}
              onClick={onNext}
              size="sm"
              variant="secondary"
            >
              Próxima →
            </Button>
          </nav>
        ) : null}

        {validationIssue ? (
          <div className="mt-6 flex flex-col gap-3 rounded-md bg-neutral-soft p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted">
                Validação geral
              </p>
              <p className="mt-1 text-sm font-bold text-muted">
                {validationIssue.description}
              </p>
            </div>
            <Badge tone={validationIssue.tone}>{validationIssue.label}</Badge>
          </div>
        ) : null}
      </article>

      <div className="border-t-2 border-border bg-canvas p-4 sm:p-6">
        <label
          className="block text-sm font-extrabold"
          htmlFor={`feedback-${item.activity.id}`}
        >
          Feedback opcional
        </label>
        <p className="mt-1 text-sm font-medium leading-6 text-muted" id={feedbackHelpId}>
          Registre uma observação sobre esta atividade. Você também pode decidir sem preencher.
        </p>
        <textarea
          aria-describedby={feedbackHelpId}
          className="mt-3 min-h-24 w-full resize-y rounded-md border-2 border-border bg-surface px-4 py-3 font-medium text-ink outline-none transition-colors placeholder:text-muted focus:border-focus focus:ring-2 focus:ring-focus/20"
          disabled={busy}
          id={`feedback-${item.activity.id}`}
          onChange={(event) => onFeedbackChange(event.target.value)}
          placeholder="Ex.: simplificar a instrução ou manter como está"
          value={feedback}
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Button disabled={busy} fullWidth onClick={onReject} size="lg" variant="danger">
            {busy ? "Salvando…" : "Rejeitar e gerar nova versão"}
          </Button>
          <Button disabled={busy} fullWidth onClick={onOpenDetails} size="lg" variant="secondary">
            Detalhes
          </Button>
          <Button disabled={busy} fullWidth onClick={onApprove} size="lg">
            {busy ? "Salvando…" : "Aprovar"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ActivityDescription({ description }: { description: string }) {
  const paragraphs = parseActivityDescription(description);

  return (
    <div className="mt-4 max-w-3xl space-y-4 font-medium leading-7 text-muted">
      {paragraphs.map(({ label, text }, index) => (
        <p className="whitespace-pre-line" key={`${label ?? "paragrafo"}-${index}`}>
          {label ? <strong className="font-extrabold text-ink">{label}: </strong> : null}
          {text}
        </p>
      ))}
    </div>
  );
}

export function ValidationDetailsModal({
  item,
  onClose,
  open,
}: {
  item: ActivityReviewItem;
  onClose: () => void;
  open: boolean;
}) {
  const report = item.validationReport;

  return (
    <Modal
      description={`Resumo dos critérios avaliados para “${item.activity.title}”.`}
      footer={<Button onClick={onClose}>Voltar à atividade</Button>}
      onClose={onClose}
      open={open}
      title="Detalhes da validação"
    >
      <dl className="grid grid-cols-3 gap-2 text-center">
        <ReportCount label="Critérios" value={report.results.length} />
        <ReportCount label="Bloqueios" value={report.summary.blockingFailures} />
        <ReportCount label="Revisar" value={report.summary.needsHumanReview} />
      </dl>

      {report.results.length > 0 ? (
        <ul aria-label="Critérios avaliados" className="mt-6 space-y-3">
          {report.results.map((result) => {
            const status = getCriterionStatusPresentation(result.status);
            const ruleReference = item.ruleReferences.find(
              ({ ruleId, ruleVersion }) =>
                ruleId === result.ruleId && ruleVersion === result.ruleVersion,
            );

            return (
              <li
                className={`rounded-md border-2 p-4 ${status.containerClassName}`}
                data-validation-status={result.status}
                key={result.id}
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${status.iconClassName}`}
                  >
                    {status.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-black">
                        {ruleReference?.title ?? "Critério da atividade"}
                      </h3>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm font-medium leading-6 text-muted">
                      {ruleReference?.description ?? result.explanation}
                    </p>
                  </div>
                </div>
                <CriterionEvidence reference={ruleReference} result={result} />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-6 rounded-md bg-neutral-soft p-4 text-sm font-bold text-muted">
          Nenhum critério individual foi registrado neste relatório.
        </p>
      )}
    </Modal>
  );
}

function CriterionEvidence({
  reference,
  result,
}: {
  reference?: ReviewRuleReference;
  result: ValidationResult;
}) {
  return (
    <details className="mt-3 rounded-md bg-surface px-3 py-2">
      <summary className="cursor-pointer rounded-sm py-1 font-extrabold text-brand-strong focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus">
        Ver evidência
      </summary>
      <dl className="mt-3 space-y-3 border-t-2 border-border pt-3 text-sm">
        <div>
          <dt className="font-extrabold">O que foi verificado</dt>
          <dd className="mt-1 font-medium leading-6 text-muted">
            {getUserFacingEvidence(result)}
          </dd>
        </div>
        {reference ? (
          <>
            <div>
              <dt className="font-extrabold">Origem do critério</dt>
              <dd className="mt-1 font-medium text-muted">
                {getRuleOriginLabel(reference.origin)}
              </dd>
            </div>
            <div>
              <dt className="font-extrabold">
                {reference.sources.length === 1 ? "Fonte" : "Fontes"}
              </dt>
              <dd>
                <ul className="mt-1 space-y-2 text-muted">
                  {reference.sources.map((source) => (
                    <li className="font-medium leading-6" key={source.id}>
                      <cite className="font-bold not-italic text-ink">{source.title}</cite>
                      {` — ${source.authors.join(", ")}`}
                      {source.publicationYear ? ` (${source.publicationYear})` : ""}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </>
        ) : null}
      </dl>
    </details>
  );
}

function getUserFacingEvidence(result: ValidationResult): string {
  if (result.ruleId === "DET-001") {
    return result.status === "passed"
      ? "A atividade contém todas as informações necessárias e está associada ao lote correto."
      : "Há informações obrigatórias ausentes ou inválidas, ou o vínculo com o lote precisa ser corrigido.";
  }

  if (result.ruleId === "DET-002") {
    return result.status === "passed"
      ? "O título e a descrição estão preenchidos."
      : "O título ou a descrição precisa ser preenchido.";
  }

  return result.evidence ?? "Nenhuma evidência foi registrada pelo avaliador.";
}

function ReportCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-neutral-soft p-3">
      <dt className="text-xs font-extrabold text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-black">{value}</dd>
    </div>
  );
}

function ReviewCompleteState({
  approved,
  headingRef,
  onReviewAgain,
  rejected,
  total,
}: {
  approved: number;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onReviewAgain: () => void;
  rejected: number;
  total: number;
}) {
  return (
    <Card aria-live="polite" className="mt-6 text-center" padding="lg" role="status">
      <span aria-hidden="true" className="text-4xl">
        ✓
      </span>
      <h2
        className="mt-3 text-2xl font-black focus:outline-none"
        ref={headingRef}
        tabIndex={-1}
      >
        Lote revisado
      </h2>
      <p className="mx-auto mt-3 max-w-xl font-medium leading-7 text-muted">
        Você revisou {total} {total === 1 ? "atividade" : "atividades"}: {approved} {" "}
        {approved === 1 ? "aprovada" : "aprovadas"} e {rejected} {" "}
        {rejected === 1 ? "rejeitada" : "rejeitadas"}.
      </p>
      <Button className="mt-6" onClick={onReviewAgain} variant="secondary">
        Rever atividades
      </Button>
    </Card>
  );
}

function ReviewLoadingState() {
  return (
    <section aria-busy="true" aria-labelledby="carregando-revisao" role="status">
      <Badge tone="info">Etapa 3 · Revisão</Badge>
      <h1 className="mt-4 text-title font-black" id="carregando-revisao">
        Preparando atividades para revisão
      </h1>
      <p className="mt-3 font-medium text-muted">
        Estamos organizando o lote e seus relatórios de validação.
      </p>
      <Card className="mt-7 animate-pulse motion-reduce:animate-none" padding="lg">
        <div aria-hidden="true" className="h-5 w-32 rounded-pill bg-track" />
        <div aria-hidden="true" className="mt-6 h-9 w-3/4 rounded-md bg-track" />
        <div aria-hidden="true" className="mt-5 h-24 rounded-md bg-track" />
      </Card>
    </section>
  );
}

function ReviewErrorState({ message }: { message: string }) {
  return (
    <section aria-labelledby="erro-revisao" role="alert">
      <Badge tone="danger">Falha no carregamento</Badge>
      <Card className="mt-5" padding="lg" raised={false} tone="outlined">
        <h1 className="text-2xl font-black" id="erro-revisao">
          Não foi possível abrir a revisão
        </h1>
        <p className="mt-3 font-medium leading-7 text-muted">{message}</p>
      </Card>
    </section>
  );
}

function ReviewEmptyState() {
  return (
    <section aria-labelledby="revisao-vazia" role="status">
      <Badge tone="neutral">Sem atividades</Badge>
      <Card className="mt-5" padding="lg" raised={false} tone="outlined">
        <h1 className="text-2xl font-black" id="revisao-vazia">
          Nenhuma atividade para revisar
        </h1>
        <p className="mt-3 font-medium leading-7 text-muted">
          Gere um lote de atividades para iniciar a revisão pedagógica.
        </p>
      </Card>
    </section>
  );
}

function getValidationIssuePresentation(item: ActivityReviewItem) {
  if (item.validationReport.summary.blockingFailures > 0) {
    return {
      label: "Requer ajustes",
      description: "O relatório encontrou pelo menos um critério bloqueante.",
      tone: "danger" as const,
    };
  }

  if (item.validationReport.summary.needsHumanReview > 0) {
    return {
      label: "Revisão humana",
      description: "Há critérios que precisam da sua avaliação.",
      tone: "warning" as const,
    };
  }

  return null;
}

function getCriterionStatusPresentation(status: ValidationStatus) {
  switch (status) {
    case "passed":
      return {
        label: "Atendido",
        icon: "✓",
        iconClassName: "bg-success-soft text-success",
        tone: "success" as const,
        containerClassName: "border-border bg-surface",
      };
    case "failed":
      return {
        label: "Não atendido",
        icon: "×",
        iconClassName: "bg-danger-soft text-danger",
        tone: "danger" as const,
        containerClassName: "border-danger bg-danger-soft",
      };
    case "needs_review":
      return {
        label: "Revisar",
        icon: "!",
        iconClassName: "bg-warning-soft text-warning",
        tone: "warning" as const,
        containerClassName: "border-warning bg-warning-soft",
      };
    case "not_applicable":
      return {
        label: "Não aplicável",
        icon: "—",
        iconClassName: "bg-neutral-soft text-muted",
        tone: "neutral" as const,
        containerClassName: "border-border bg-neutral-soft",
      };
    case "not_evaluated":
      return {
        label: "Não avaliado",
        icon: "?",
        iconClassName: "bg-warning-soft text-warning",
        tone: "warning" as const,
        containerClassName: "border-warning bg-warning-soft",
      };
  }
}

function getRuleOriginLabel(origin: ReviewRuleReference["origin"]) {
  switch (origin) {
    case "direct":
      return "Evidência direta";
    case "pedagogical_inference":
      return "Inferência pedagógica";
    case "editorial":
      return "Regra editorial";
  }
}
