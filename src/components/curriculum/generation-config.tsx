"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";

import { generateBatchAction } from "@/app/actions";
import { Badge, Button, Card } from "@/components/ui";
import type { Lesson } from "@/domain/curriculum";
import type { CurriculumSelection } from "@/domain/curriculum-navigation";
import {
  DEFAULT_ACTIVITY_COUNT,
  DEFAULT_DURATION_MINUTES,
  MAX_ACTIVITY_COUNT,
  MAX_DURATION_MINUTES,
  MIN_ACTIVITY_COUNT,
  MIN_DURATION_MINUTES,
  estimateActivityDistribution,
  generationConfigSchema,
} from "@/domain/generation-config";

type GenerationConfigFormProps = {
  lesson: Lesson;
  onBack: () => void;
  selection: CurriculumSelection;
};

function numberFromInput(value: string) {
  return value.trim() === "" ? Number.NaN : Number(value);
}

function getDurationError(duration: number, activityCount: number) {
  if (!Number.isFinite(duration)) {
    return "Informe a duração total.";
  }

  if (!Number.isInteger(duration)) {
    return "Use um número inteiro de minutos.";
  }

  if (duration < MIN_DURATION_MINUTES) {
    return `A duração deve ser de pelo menos ${MIN_DURATION_MINUTES} minutos.`;
  }

  if (duration > MAX_DURATION_MINUTES) {
    return `A duração deve ser de no máximo ${MAX_DURATION_MINUTES} minutos.`;
  }

  if (duration < activityCount) {
    return "A duração deve permitir pelo menos 1 minuto por atividade.";
  }
}

export function GenerationConfigForm({ lesson, onBack, selection }: GenerationConfigFormProps) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [durationMinutes, setDurationMinutes] = useState(String(DEFAULT_DURATION_MINUTES));
  const [activityCount, setActivityCount] = useState(String(DEFAULT_ACTIVITY_COUNT));
  const [durationTouched, setDurationTouched] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isGenerating, startGeneration] = useTransition();

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const candidate = {
    requestedDurationMinutes: numberFromInput(durationMinutes),
    requestedActivityCount: numberFromInput(activityCount),
  };
  const validation = generationConfigSchema.safeParse(candidate);
  const distribution = validation.success
    ? estimateActivityDistribution(validation.data)
    : [];
  const durationError = getDurationError(
    candidate.requestedDurationMinutes,
    candidate.requestedActivityCount,
  );

  function updateDuration(value: string) {
    setDurationMinutes(value);
    setGenerationError(null);
  }

  function updateActivityCount(value: string) {
    setActivityCount(value);
    setGenerationError(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDurationTouched(true);

    if (!validation.success) {
      return;
    }

    setGenerationError(null);
    startGeneration(async () => {
      const result = await generateBatchAction({ selection, config: validation.data });

      if (!result.ok) {
        setGenerationError(result.message);
        return;
      }

      router.push(`/revisar?lote=${encodeURIComponent(result.data.batchId)}`);
    });
  }

  return (
    <section aria-labelledby="configuracao-geracao">
      <Badge tone="info">Etapa 2 · Configuração</Badge>
      <h1
        className="mt-4 max-w-3xl text-title font-black tracking-[-0.03em] focus:outline-none sm:text-display"
        id="configuracao-geracao"
        ref={headingRef}
        tabIndex={-1}
      >
        Como será este grupo de atividades?
      </h1>
      <p className="mt-4 max-w-2xl text-lead font-medium text-muted">
        Defina o tempo total e a quantidade. A distribuição abaixo reserva pelo menos um
        minuto para cada atividade.
      </p>

      <Card className="mt-6" padding="sm" raised={false} tone="soft">
        <p className="text-sm font-extrabold text-muted">Aula selecionada</p>
        <p className="mt-1 font-black">Aula {lesson.number}</p>
        <p className="mt-1 text-sm font-medium leading-6 text-muted">
          {lesson.specificObjective}
        </p>
      </Card>

      <form className="mt-8" noValidate onSubmit={submit}>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="block font-extrabold" htmlFor="duracao-total">
              Duração total
            </label>
            <div className="relative mt-2">
              <input
                aria-describedby="ajuda-duracao erro-duracao"
                aria-invalid={durationTouched && Boolean(durationError)}
                className="min-h-12 w-full rounded-md border-2 border-border bg-surface px-4 pr-24 text-lg font-extrabold text-ink focus-visible:border-focus focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
                id="duracao-total"
                inputMode="numeric"
                max={MAX_DURATION_MINUTES}
                min={MIN_DURATION_MINUTES}
                onBlur={() => setDurationTouched(true)}
                onChange={(event) => updateDuration(event.target.value)}
                step={1}
                type="number"
                value={durationMinutes}
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-extrabold text-muted">
                minutos
              </span>
            </div>
            <p className="mt-2 text-sm font-medium text-muted" id="ajuda-duracao">
              Entre {MIN_DURATION_MINUTES} e {MAX_DURATION_MINUTES} minutos. O padrão é {" "}
              {DEFAULT_DURATION_MINUTES}.
            </p>
            <p
              aria-live="polite"
              className="mt-2 min-h-6 text-sm font-extrabold text-danger"
              id="erro-duracao"
            >
              {durationTouched ? durationError : null}
            </p>
          </div>

          <div>
            <label className="block font-extrabold" htmlFor="quantidade-atividades">
              Quantidade de atividades
            </label>
            <select
              className="mt-2 min-h-12 w-full rounded-md border-2 border-border bg-surface px-4 text-lg font-extrabold text-ink focus-visible:border-focus focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
              id="quantidade-atividades"
              onChange={(event) => updateActivityCount(event.target.value)}
              value={activityCount}
            >
              {Array.from(
                { length: MAX_ACTIVITY_COUNT - MIN_ACTIVITY_COUNT + 1 },
                (_, index) => MIN_ACTIVITY_COUNT + index,
              ).map((count) => (
                <option key={count} value={count}>
                  {count} {count === 1 ? "atividade" : "atividades"}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm font-medium text-muted">
              Escolha de {MIN_ACTIVITY_COUNT} a {MAX_ACTIVITY_COUNT} atividades.
            </p>
          </div>
        </div>

        <Card className="mt-8" padding="md" raised={false} tone="outlined">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Distribuição estimada</h2>
              <p className="mt-1 text-sm font-medium text-muted">
                O tempo é dividido em minutos inteiros e poderá orientar a geração.
              </p>
            </div>
            {validation.success ? (
              <p className="text-lg font-black" data-testid="distribution-total">
                Total: {validation.data.requestedDurationMinutes} min
              </p>
            ) : null}
          </div>

          {distribution.length > 0 ? (
            <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {distribution.map((estimate) => (
                <li
                  className="flex items-center justify-between gap-3 rounded-md bg-neutral-soft px-4 py-3"
                  key={estimate.slotIndex}
                >
                  <span className="font-extrabold">Atividade {estimate.slotIndex + 1}</span>
                  <span className="whitespace-nowrap font-black">
                    {estimate.durationMinutes} min
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-5 rounded-md bg-danger-soft px-4 py-3 font-bold text-danger">
              Informe uma duração válida para visualizar a distribuição.
            </p>
          )}
        </Card>

        {isGenerating ? (
          <Card
            aria-live="polite"
            aria-busy="true"
            className="mt-6"
            padding="sm"
            raised={false}
            tone="soft"
          >
            <p className="font-black">Gerando e validando o lote</p>
            <p className="mt-1 text-sm font-medium text-muted">
              As atividades, os relatórios e o consumo de tokens serão salvos antes da revisão.
            </p>
          </Card>
        ) : null}

        {generationError ? (
          <Card
            className="mt-6 border-danger text-danger"
            padding="sm"
            raised={false}
            role="alert"
            tone="outlined"
          >
            <p className="font-black">Não foi possível gerar o lote</p>
            <p className="mt-1 text-sm font-medium">{generationError}</p>
          </Card>
        ) : null}

        <div className="mt-8 flex flex-col-reverse gap-3 border-t-2 border-border pt-6 sm:flex-row">
          <Button
            className="sm:w-auto"
            disabled={isGenerating}
            onClick={onBack}
            size="lg"
            variant="secondary"
          >
            Voltar ao currículo
          </Button>
          <Button
            className="sm:flex-1"
            disabled={!validation.success || isGenerating}
            size="lg"
            type="submit"
          >
            {isGenerating ? "Gerando atividades…" : "Confirmar e gerar atividades"}
          </Button>
        </div>
      </form>
    </section>
  );
}
