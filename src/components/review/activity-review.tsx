"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Badge, Button, Card, Modal, Progress } from "@/components/ui";
import type { ActivityReviewItem, ReviewRuleReference } from "@/domain/review";
import {
  createReviewSession,
  decideCurrentReviewItem,
  getCurrentReviewItem,
  getReviewProgress,
} from "@/domain/review-session";
import type { ValidationStatus } from "@/domain/rules";

export type ActivityReviewLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: readonly ActivityReviewItem[] };

export type ActivityReviewProps = {
  state: ActivityReviewLoadState;
};

type DecisionFeedback = {
  message: string;
  tone: "success" | "danger";
};

export function ActivityReview({ state }: ActivityReviewProps) {
  if (state.status === "loading") {
    return <ReviewLoadingState />;
  }

  if (state.status === "error") {
    return <ReviewErrorState message={state.message} />;
  }

  if (state.items.length === 0) {
    return <ReviewEmptyState />;
  }

  return <ReadyActivityReview items={state.items} />;
}

function ReadyActivityReview({ items }: { items: readonly ActivityReviewItem[] }) {
  const [session, setSession] = useState(() => createReviewSession(items));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [decisionFeedback, setDecisionFeedback] = useState<DecisionFeedback | null>(null);
  const [feedback, setFeedback] = useState("");
  const activityHeadingRef = useRef<HTMLHeadingElement>(null);
  const completionHeadingRef = useRef<HTMLHeadingElement>(null);
  const closeDetails = useCallback(() => setDetailsOpen(false), []);
  const currentItem = getCurrentReviewItem(session);
  const progress = getReviewProgress(session);

  useEffect(() => {
    if (currentItem) {
      activityHeadingRef.current?.focus();
    } else {
      completionHeadingRef.current?.focus();
    }
  }, [currentItem]);

  function decide(decision: "approved" | "rejected") {
    if (!currentItem) {
      return;
    }

    const title = currentItem.activity.title;
    setSession((currentSession) =>
      decideCurrentReviewItem(currentSession, decision, feedback),
    );
    setDecisionFeedback({
      message:
        decision === "approved"
          ? `“${title}” foi aprovada.`
          : `“${title}” foi rejeitada.`,
      tone: decision === "approved" ? "success" : "danger",
    });
    setFeedback("");
    setDetailsOpen(false);
  }

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
        <p className="font-extrabold text-muted">
          {progress.reviewed} de {progress.total} revisadas
        </p>
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

      {decisionFeedback && currentItem ? (
        <div
          className={`mt-5 rounded-md px-4 py-3 text-sm font-extrabold ${
            decisionFeedback.tone === "success"
              ? "bg-success-soft text-success"
              : "bg-danger-soft text-danger"
          }`}
          role="status"
        >
          {decisionFeedback.message} A próxima proposta está pronta para revisão.
        </div>
      ) : null}

      {currentItem ? (
        <ActivityCard
          feedback={feedback}
          item={currentItem}
          onApprove={() => decide("approved")}
          onFeedbackChange={setFeedback}
          onOpenDetails={() => setDetailsOpen(true)}
          onReject={() => decide("rejected")}
          position={progress.reviewed + 1}
          titleRef={activityHeadingRef}
          total={progress.total}
        />
      ) : (
        <ReviewCompleteState
          approved={progress.approved}
          headingRef={completionHeadingRef}
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
  feedback,
  item,
  onApprove,
  onFeedbackChange,
  onOpenDetails,
  onReject,
  position,
  titleRef,
  total,
}: {
  feedback: string;
  item: ActivityReviewItem;
  onApprove: () => void;
  onFeedbackChange: (feedback: string) => void;
  onOpenDetails: () => void;
  onReject: () => void;
  position: number;
  titleRef: React.RefObject<HTMLHeadingElement | null>;
  total: number;
}) {
  const validation = getValidationPresentation(item);
  const feedbackHelpId = `ajuda-feedback-${item.activity.id}`;

  return (
    <Card className="mt-6 overflow-hidden" padding="none">
      <article aria-labelledby={`atividade-${item.activity.id}`} className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-extrabold uppercase tracking-[0.08em] text-muted">
            Atividade {position} de {total}
          </p>
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
        <p className="mt-4 max-w-3xl font-medium leading-7 text-muted">
          {item.activity.description}
        </p>

        <div className="mt-6 flex flex-col gap-3 rounded-md bg-neutral-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted">
              Validação geral
            </p>
            <p className="mt-1 text-sm font-bold text-muted">{validation.description}</p>
          </div>
          <Badge tone={validation.tone}>{validation.label}</Badge>
        </div>
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
          id={`feedback-${item.activity.id}`}
          onChange={(event) => onFeedbackChange(event.target.value)}
          placeholder="Ex.: simplificar a instrução ou manter como está"
          value={feedback}
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Button fullWidth onClick={onReject} size="lg" variant="danger">
            Rejeitar
          </Button>
          <Button fullWidth onClick={onOpenDetails} size="lg" variant="secondary">
            Detalhes
          </Button>
          <Button fullWidth onClick={onApprove} size="lg">
            Aprovar
          </Button>
        </div>
      </div>
    </Card>
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-black">
                      {ruleReference?.title ?? `Regra ${result.ruleId}`}
                    </h3>
                    <p className="mt-1 text-xs font-bold text-muted">
                      Regra {result.ruleId} · versão {result.ruleVersion}
                    </p>
                  </div>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <p className="mt-2 text-sm font-medium leading-6 text-muted">
                  {result.explanation}
                </p>
                <div className="mt-4 rounded-md bg-surface p-3">
                  <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted">
                    Evidência
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6">
                    {result.evidence ?? "Nenhuma evidência foi registrada pelo avaliador."}
                  </p>
                </div>
                {ruleReference ? <RuleTraceability reference={ruleReference} /> : null}
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

function RuleTraceability({ reference }: { reference: ReviewRuleReference }) {
  return (
    <details className="mt-3 rounded-md bg-surface px-3 py-2">
      <summary className="cursor-pointer rounded-sm py-1 font-extrabold text-brand-strong focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus">
        Ver origem e fonte
      </summary>
      <dl className="mt-3 space-y-3 border-t-2 border-border pt-3 text-sm">
        <div>
          <dt className="font-extrabold">Tipo de origem</dt>
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
                  {source.locator ? `. ${source.locator}` : ""}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
    </details>
  );
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
  rejected,
  total,
}: {
  approved: number;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
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

function getValidationPresentation(item: ActivityReviewItem) {
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

  return {
    label: "Validação aprovada",
    description: "Nenhum bloqueio ou pendência foi registrado.",
    tone: "success" as const,
  };
}

function getCriterionStatusPresentation(status: ValidationStatus) {
  switch (status) {
    case "passed":
      return {
        label: "Atendido",
        tone: "success" as const,
        containerClassName: "border-border bg-surface",
      };
    case "failed":
      return {
        label: "Não atendido",
        tone: "danger" as const,
        containerClassName: "border-danger bg-danger-soft",
      };
    case "needs_review":
      return {
        label: "Revisar",
        tone: "warning" as const,
        containerClassName: "border-warning bg-warning-soft",
      };
    case "not_applicable":
      return {
        label: "Não aplicável",
        tone: "neutral" as const,
        containerClassName: "border-border bg-neutral-soft",
      };
    case "not_evaluated":
      return {
        label: "Não avaliado",
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
