import Link from "next/link";

import { Badge, Card } from "@/components/ui";
import type { TrailLessonSummary, TrailSummary as TrailSummaryData } from "@/server/generation/trail-summary";

function reviewedActivitiesHref(selection: {
  lessonId: string;
  objectiveId: string;
  skillId: string;
  themeId: string;
  weekId: string;
}): string {
  const parameters = new URLSearchParams({
    themeId: selection.themeId,
    skillId: selection.skillId,
    objectiveId: selection.objectiveId,
    weekId: selection.weekId,
    lessonId: selection.lessonId,
  });
  return `/atividades?${parameters.toString()}`;
}

export function TrailSummary({ summary }: { summary: TrailSummaryData }) {
  const hasUsefulActivities =
    summary.reviewedActivities + summary.pendingActivities > 0;

  return (
    <section aria-labelledby="titulo-resumo-trilha">
      <Badge tone="info">Visão curricular</Badge>
      <h1
        className="mt-4 text-title font-black tracking-[-0.03em] sm:text-display"
        id="titulo-resumo-trilha"
      >
        Resumo da trilha
      </h1>
      <p className="mt-3 max-w-3xl text-lead font-medium text-muted">
        Acompanhe as atividades revisadas e pendentes em cada aula, sem perder a ordem do currículo.
      </p>

      <div className="mt-7 grid gap-3 sm:grid-cols-3" aria-label="Totais da trilha">
        <TrailTotal label="Aulas" value={summary.totalLessons} />
        <TrailTotal label="Atividades revisadas" value={summary.reviewedActivities} />
        <TrailTotal label="Atividades pendentes" value={summary.pendingActivities} />
      </div>

      {!hasUsefulActivities ? (
        <Card className="mt-7" padding="md" raised={false} tone="soft">
          <h2 className="text-lg font-black">A trilha está pronta para começar</h2>
          <p className="mt-2 font-medium leading-7 text-muted">
            Todas as aulas aparecem abaixo com contagens zeradas. Selecione uma delas para gerar o primeiro lote.
          </p>
          <Link
            className="mt-4 inline-flex min-h-touch items-center font-extrabold text-brand-strong underline decoration-2 underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus"
            href="/planejar"
          >
            Planejar uma aula
          </Link>
        </Card>
      ) : null}

      <div className="mt-10">
        <p className="text-sm font-extrabold uppercase tracking-[0.1em] text-brand-strong">
          Tema
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.03em]">
          {summary.theme.name}
        </h2>
      </div>

      <div className="mt-8 space-y-12">
        {summary.theme.skills.map((skill, skillIndex) => (
          <section aria-labelledby={`habilidade-trilha-${skill.id}`} key={skill.id}>
            <div className="flex items-start gap-4 border-b-2 border-border pb-4">
              <span
                aria-hidden="true"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-soft font-black text-brand-strong"
              >
                {skillIndex + 1}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted">
                  Habilidade {skillIndex + 1}
                </p>
                <h3
                  className="mt-1 break-words text-2xl font-black tracking-[-0.02em]"
                  id={`habilidade-trilha-${skill.id}`}
                >
                  {skill.name}
                </h3>
              </div>
            </div>

            <div className="mt-6 space-y-7">
              {skill.objectives.map((objective, objectiveIndex) => (
                <Card key={objective.id} padding="none" raised={false} tone="outlined">
                  <section aria-labelledby={`objetivo-trilha-${objective.id}`}>
                    <div className="border-b-2 border-border bg-neutral-soft p-5 sm:p-6">
                      <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted">
                        Objetivo {objectiveIndex + 1}
                      </p>
                      <h4
                        className="mt-2 break-words text-xl font-black"
                        id={`objetivo-trilha-${objective.id}`}
                      >
                        {objective.name}
                      </h4>
                    </div>

                    {objective.weeks.map((week) => (
                      <section
                        aria-labelledby={`semana-trilha-${week.id}`}
                        className="p-4 sm:p-6"
                        key={week.id}
                      >
                        <h5
                          className="text-sm font-extrabold uppercase tracking-[0.08em] text-brand-strong"
                          id={`semana-trilha-${week.id}`}
                        >
                          {week.title}
                        </h5>
                        <ol className="mt-4 grid gap-3">
                          {week.lessons.map((lesson) => (
                            <TrailLesson
                              key={lesson.id}
                              lesson={lesson}
                              selection={{
                                lessonId: lesson.id,
                                objectiveId: objective.id,
                                skillId: skill.id,
                                themeId: summary.theme.id,
                                weekId: week.id,
                              }}
                            />
                          ))}
                        </ol>
                      </section>
                    ))}
                  </section>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function TrailTotal({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border-2 border-border bg-surface p-4">
      <p className="text-2xl font-black text-ink">{value}</p>
      <p className="mt-1 text-sm font-extrabold text-muted">{label}</p>
    </div>
  );
}

function TrailLesson({
  lesson,
  selection,
}: {
  lesson: TrailLessonSummary;
  selection: {
    lessonId: string;
    objectiveId: string;
    skillId: string;
    themeId: string;
    weekId: string;
  };
}) {
  return (
    <li
      aria-label={`Aula ${lesson.number}: ${lesson.specificObjective}`}
      className="min-w-0 rounded-md border-2 border-border bg-surface p-4 sm:p-5"
      data-testid="trail-lesson"
    >
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-brand-strong">Aula {lesson.number}</p>
          <p className="mt-1 break-words font-black leading-6">{lesson.specificObjective}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 text-sm font-extrabold">
          <span className="rounded-pill bg-neutral-soft px-3 py-2 text-muted">
            Pendentes: {lesson.pendingActivities}
          </span>
          <span className="rounded-pill bg-success-soft px-3 py-2 text-success">
            Revisadas: {lesson.reviewedActivities}
          </span>
        </div>
      </div>

      {lesson.reviewedActivities > 0 ? (
        <Link
          className="mt-4 inline-flex min-h-touch items-center font-extrabold text-brand-strong underline decoration-2 underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus"
          href={reviewedActivitiesHref(selection)}
        >
          Ver atividades revisadas desta aula
        </Link>
      ) : null}
    </li>
  );
}
