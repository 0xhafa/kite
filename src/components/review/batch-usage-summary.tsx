import { Card } from "@/components/ui";
import type { BatchTokenUsage } from "@/domain/usage";

export type BatchUsageSummaryProps = {
  usage: BatchTokenUsage | null;
};

const tokenNumberFormatter = new Intl.NumberFormat("pt-BR");

export function BatchUsageSummary({ usage }: BatchUsageSummaryProps) {
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
        {usage ? (
          <p className="text-sm font-extrabold text-muted">
            Lote <span className="text-ink">{usage.batchId}</span>
          </p>
        ) : null}
      </div>

      {usage ? (
        <Card className="mt-4" padding="sm" raised={false} tone="outlined">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <UsageMetric label="Total" value={usage.totalTokens} />
            <UsageMetric label="Geração" value={usage.byStage.generate} />
            <UsageMetric label="Validação" value={usage.byStage.validate} />
            <UsageMetric label="Reparos" value={usage.byStage.repair} />
            <UsageMetric label="Chamadas" value={usage.callCount} />
          </dl>
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
