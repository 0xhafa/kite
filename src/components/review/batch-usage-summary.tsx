"use client";

import { useId, useState } from "react";

import type { BatchTokenUsage } from "@/domain/usage";

export type BatchUsageSummaryProps = {
  usage: BatchTokenUsage | null;
};

const tokenNumberFormatter = new Intl.NumberFormat("pt-BR");
const usdFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 6,
});

export function BatchUsageSummary({ usage }: BatchUsageSummaryProps) {
  const usageTooltipId = useId();
  const [usageTooltipPinned, setUsageTooltipPinned] = useState(false);

  return (
    <section
      aria-label="Consumo de tokens do lote"
      className="group shrink-0 sm:relative"
    >
      <button
        aria-describedby={usageTooltipId}
        aria-expanded={usageTooltipPinned}
        aria-label="Ver consumo e custo estimado do lote"
        className="inline-flex size-touch items-center justify-center rounded-full border-2 border-border bg-surface text-muted shadow-raised transition-[color,background-color,border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-muted hover:text-ink active:translate-y-0 active:shadow-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus"
        onClick={() => setUsageTooltipPinned((current) => !current)}
        type="button"
      >
        <UsageGaugeIcon />
      </button>

      <div
        className={`${
          usageTooltipPinned ? "visible opacity-100" : "invisible opacity-0"
        } pointer-events-none absolute right-0 top-[calc(100%+0.5rem)] z-20 w-80 max-w-[calc(100vw-2.5rem)] rounded-md border-2 border-ink bg-ink p-4 text-left text-surface shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 motion-reduce:transition-none`}
        id={usageTooltipId}
        role="tooltip"
      >
        <p className="text-base font-black">Consumo e custo do lote</p>
        <p className="mt-1 text-xs font-medium leading-5 text-surface/75">
          Uso técnico registrado na geração e na revisão automática.
        </p>

        {usage ? (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="col-span-2 rounded-md bg-surface/10 px-3 py-3">
                <TechnicalMetric label="Total de tokens" value={usage.totalTokens} />
              </div>
              <TechnicalMetric label="Geração" value={usage.byStage.generate} />
              <TechnicalMetric label="Validação" value={usage.byStage.validate} />
              <TechnicalMetric label="Reparos" value={usage.byStage.repair} />
              <TechnicalMetric label="Chamadas" value={usage.callCount} />
              <div className="col-span-2 border-t border-surface/25 pt-3">
                <dt className="text-xs font-extrabold uppercase tracking-[0.06em] text-surface/75">
                  Custo estimado
                </dt>
                <dd className="mt-1 text-base font-black">
                  {usage.estimatedCostUsd === null
                    ? "Indisponível"
                    : usdFormatter.format(usage.estimatedCostUsd)}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.06em] text-surface/75">
              Identificador do lote
            </p>
            <p className="mt-1 break-all text-sm font-black">{usage.batchId}</p>
            <p className="mt-3 text-xs font-medium leading-5 text-surface/75">
              Estimativa pela tabela padrão de preços ({usage.pricingVersion}), sem
              descontos de cache. O valor faturado pode variar.
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm font-bold leading-6">
            Nenhum consumo de tokens foi registrado para este lote.
          </p>
        )}
      </div>
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

function UsageGaugeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-6"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5.6 17.5a8 8 0 1 1 12.8 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <path
        d="m12 14.5 3.1-4.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <circle cx="12" cy="14.5" fill="currentColor" r="1.5" />
      <path
        d="M7.2 17.5h9.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}
