import type { Metadata } from "next";
import Link from "next/link";

import { ActivityDescription } from "@/components/activity-description";
import { AppShell } from "@/components/app-shell";
import { Badge, Card } from "@/components/ui";
import { loadReviewedActivityLibrary } from "@/server/generation/integrated-flow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Atividades revisadas | Kite",
  description: "Biblioteca persistente das atividades que já passaram pela revisão pedagógica.",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function ReviewedActivitiesPage() {
  const library = await loadReviewedActivityLibrary();
  const reviewedBatches = library.filter(({ reviewedActivities }) => reviewedActivities.length > 0);
  const reviewedActivityCount = reviewedBatches.reduce(
    (total, batch) => total + batch.reviewedActivities.length,
    0,
  );
  const pendingBatch = library.find(({ completed }) => !completed);

  return (
    <AppShell mainClassName="max-w-5xl" sectionLabel="Biblioteca">
      <section aria-labelledby="titulo-atividades-revisadas">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge tone="success">Biblioteca persistente</Badge>
            <h1
              className="mt-4 text-title font-black tracking-[-0.03em] sm:text-display"
              id="titulo-atividades-revisadas"
            >
              Atividades revisadas
            </h1>
            <p className="mt-3 max-w-2xl text-lead font-medium text-muted">
              Tudo o que você já revisou continua salvo e acessível aqui.
            </p>
          </div>
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-md border-2 border-ink bg-ink px-6 py-3 font-extrabold text-surface shadow-action transition-transform hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus"
            href="/planejar"
          >
            Planejar novo lote
          </Link>
        </div>

        {reviewedActivityCount > 0 ? (
          <>
            <p className="mt-8 font-extrabold text-muted" role="status">
              {reviewedActivityCount} {reviewedActivityCount === 1 ? "atividade em" : "atividades em"} {reviewedBatches.length} {reviewedBatches.length === 1 ? "lote" : "lotes"}
            </p>
            <div className="mt-5 space-y-8">
              {reviewedBatches.map((batch) => (
                <Card key={batch.batchId} padding="none">
                  <section aria-labelledby={`lote-${batch.batchId}`}>
                    <div className="border-b-2 border-border bg-neutral-soft p-5 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-extrabold text-muted">
                            {batch.lesson.weekTitle} · Aula {batch.lesson.number}
                          </p>
                          <h2 className="mt-1 text-xl font-black" id={`lote-${batch.batchId}`}>
                            {batch.lesson.specificObjective}
                          </h2>
                          <p className="mt-2 text-sm font-medium text-muted">
                            Gerado em <time dateTime={batch.createdAt}>{dateFormatter.format(new Date(batch.createdAt))}</time>
                          </p>
                        </div>
                        <Badge tone={batch.completed ? "success" : "warning"}>
                          {batch.completed ? "Lote concluído" : "Revisão em andamento"}
                        </Badge>
                      </div>
                    </div>

                    <ol className="divide-y-2 divide-border">
                      {batch.reviewedActivities.map(({ activity, decision }, index) => (
                        <li className="p-5 sm:p-7" key={activity.id}>
                          <article aria-labelledby={`atividade-revisada-${activity.id}`}>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="text-sm font-extrabold uppercase tracking-[0.08em] text-muted">
                                Atividade {activity.slotIndex + 1}
                              </p>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-extrabold text-muted">
                                  {activity.durationMinutes} min
                                </span>
                                <Badge tone={decision.decision === "approved" ? "success" : "danger"}>
                                  {decision.decision === "approved" ? "Aprovada" : "Rejeitada"}
                                </Badge>
                              </div>
                            </div>
                            <h3
                              className="mt-4 text-2xl font-black tracking-[-0.02em]"
                              id={`atividade-revisada-${activity.id}`}
                            >
                              {activity.title}
                            </h3>
                            <ActivityDescription description={activity.description} />
                            {decision.feedback ? (
                              <div className="mt-5 rounded-md bg-neutral-soft p-4">
                                <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted">
                                  Feedback da revisão
                                </p>
                                <p className="mt-2 font-medium leading-7 text-muted">
                                  {decision.feedback}
                                </p>
                              </div>
                            ) : null}
                            {index === batch.reviewedActivities.length - 1 ? (
                              <Link
                                className="mt-5 inline-flex min-h-touch items-center rounded-md font-extrabold text-brand-strong underline decoration-2 underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus"
                                href={`/revisar?lote=${encodeURIComponent(batch.batchId)}`}
                              >
                                Abrir resumo do lote
                              </Link>
                            ) : null}
                          </article>
                        </li>
                      ))}
                    </ol>
                  </section>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <Card className="mt-8" padding="lg" raised={false} tone="outlined">
            <h2 className="text-2xl font-black">Nenhuma atividade revisada ainda</h2>
            <p className="mt-3 font-medium leading-7 text-muted">
              Assim que você aprovar uma atividade, ela aparecerá nesta página e continuará salva.
            </p>
            <Link
              className="mt-5 inline-flex min-h-touch items-center rounded-md font-extrabold text-brand-strong underline decoration-2 underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus"
              href={pendingBatch ? `/revisar?lote=${encodeURIComponent(pendingBatch.batchId)}` : "/planejar"}
            >
              {pendingBatch ? "Continuar revisão" : "Selecionar uma aula"}
            </Link>
          </Card>
        )}

        {pendingBatch && reviewedActivityCount > 0 ? (
          <Card className="mt-8" padding="md" raised={false} tone="soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-black">Há um lote em andamento</h2>
                <p className="mt-1 text-sm font-medium text-muted">
                  As decisões já registradas estão salvas. Você pode continuar de onde parou.
                </p>
              </div>
              <Link
                className="font-extrabold text-brand-strong underline decoration-2 underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus"
                href={`/revisar?lote=${encodeURIComponent(pendingBatch.batchId)}`}
              >
                Continuar revisão
              </Link>
            </div>
          </Card>
        ) : null}
      </section>
    </AppShell>
  );
}
