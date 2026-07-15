import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ReviewedActivityLibrary } from "@/components/review/reviewed-activity-library";
import { Badge } from "@/components/ui";
import { loadReviewedActivityLibrary } from "@/server/generation/integrated-flow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Atividades revisadas | Kite",
  description: "Biblioteca persistente das atividades que já passaram pela revisão pedagógica.",
};

export default async function ReviewedActivitiesPage() {
  const library = await loadReviewedActivityLibrary();

  return (
    <AppShell mainClassName="max-w-5xl" sectionLabel="Biblioteca">
      <section aria-labelledby="titulo-atividades-revisadas">
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

        <ReviewedActivityLibrary initialBatches={library} />
      </section>
    </AppShell>
  );
}
