"use client";

import { useId, useState } from "react";

import { Card } from "@/components/ui";
import type { BatchTokenUsage } from "@/domain/usage";

export type BatchUsageSummaryProps = {
  usage: BatchTokenUsage | null;
};

const tokenNumberFormatter = new Intl.NumberFormat("pt-BR");

export function BatchUsageSummary({ usage }: BatchUsageSummaryProps) {
  const technicalDetailsId = useId();
  const [technicalDetailsPinned, setTechnicalDetailsPinned] = useState(false);

  return (
    <section aria-labelledby="titulo-consumo-tokens" className="mt-7">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            className="text-xl font-black tracking-[-0.02em]"
            id="titulo-consumo-tokens"
          >
            Consumo de tokens do lote
          </h2>
          <p className="mt-1 text-sm font-medium text-muted">
            Uso técnico registrado nas chamadas de geração e revisão automática.
          </p>
        </div>
      </div>

      {usage ? (
        <Card className="mt-4" padding="sm" raised={false} tone="outlined">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <dl className="min-w-36 flex-1">
              <UsageMetric label="Total" value={usage.totalTokens} />
            </dl>

            <div className="group relative">
              <button
                aria-describedby={technicalDetailsId}
                aria-label="Detalhes técnicos do consumo de tokens"
                className="flex min-h-touch cursor-pointer list-none items-center rounded-md border-2 border-border bg-surface px-4 py-2 text-sm font-extrabold text-ink shadow-raised transition-[background-color,border-color,box-shadow] marker:hidden hover:border-muted focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus [&::-webkit-details-marker]:hidden"
                onClick={() => setTechnicalDetailsPinned((current) => !current)}
                type="button"
              >
                Detalhes técnicos
              </button>
              <div
                className={`${
                  technicalDetailsPinned ? "visible opacity-100" : "invisible opacity-0"
                } absolute right-0 top-[calc(100%+0.5rem)] z-20 w-72 max-w-[calc(100vw-2.5rem)] rounded-md border-2 border-ink bg-ink p-4 text-surface shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 motion-reduce:transition-none`}
                id={technicalDetailsId}
                role="tooltip"
              >
                <p className="text-xs font-extrabold uppercase tracking-[0.06em] text-surface/75">
                  Identificador do lote
                </p>
                <p className="mt-1 break-all text-sm font-black">{usage.batchId}</p>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                  <TechnicalMetric label="Geração" value={usage.byStage.generate} />
                  <TechnicalMetric label="Validação" value={usage.byStage.validate} />
                  <TechnicalMetric label="Reparos" value={usage.byStage.repair} />
                  <TechnicalMetric label="Chamadas" value={usage.callCount} />
                </dl>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card
          className="mt-4 text-sm font-bold text-muted"
          padding="sm"
          raised={false}
          role="status"
          tone="outlined"
        >
          Nenhum consumo de tokens foi registrado para este lote.
        </Card>
      )}
    </section>
  );
}

function TechnicalMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs font-extrabold uppercase tracking-[0.06em] text-surface/75">
        {label}
      </dt>
      <dd className="mt-1 text-base font-black">{tokenNumberFormatter.format(value)}</dd>
    </div>
  );
}

function UsageMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-neutral-soft px-3 py-3">
      <dt className="text-xs font-extrabold uppercase tracking-[0.06em] text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-black">{tokenNumberFormatter.format(value)}</dd>
    </div>
  );
}
