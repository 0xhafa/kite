import type { Metadata } from "next";

import curriculumData from "../../../data/curriculum.json";
import { AppShell } from "@/components/app-shell";
import { TrailSummary } from "@/components/trail/trail-summary";
import { adaptCurriculum } from "@/domain/curriculum-adapter";
import { loadCachedReviewedActivityLibrary } from "@/server/generation/cache";
import { buildTrailSummary } from "@/server/generation/trail-summary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Resumo da trilha | Kite",
  description: "Visão curricular das atividades geradas e revisadas em cada aula de Fonemas.",
};

const curriculum = adaptCurriculum(curriculumData);

export default async function TrailSummaryPage() {
  const library = await loadCachedReviewedActivityLibrary();
  const summary = buildTrailSummary(curriculum, "fonemas", library);

  return (
    <AppShell mainClassName="max-w-6xl" sectionLabel="Trilha">
      <TrailSummary summary={summary} />
    </AppShell>
  );
}
