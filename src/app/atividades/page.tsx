import type { Metadata } from "next";

import curriculumData from "../../../data/curriculum.json";
import { AppShell } from "@/components/app-shell";
import { ReviewedActivityLibrary } from "@/components/review/reviewed-activity-library";
import type { ReviewedActivityLibraryInitialFilters } from "@/components/review/reviewed-activity-library";
import { Badge } from "@/components/ui";
import { adaptCurriculum } from "@/domain/curriculum-adapter";
import { loadCachedReviewedActivityLibrary } from "@/server/generation/cache";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Atividades revisadas | Kite",
  description: "Biblioteca persistente das atividades que já passaram pela revisão pedagógica.",
};

const curriculum = adaptCurriculum(curriculumData);

type ReviewedActivitiesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParameter(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function initialFiltersFromParameters(
  parameters: Record<string, string | string[] | undefined>,
): ReviewedActivityLibraryInitialFilters {
  const themeId = firstParameter(parameters.themeId);
  const theme = curriculum.themes.find(({ id }) => id === themeId);
  if (!theme) return {};

  const filters: ReviewedActivityLibraryInitialFilters = { themeId: theme.id };
  const skillId = firstParameter(parameters.skillId);
  const skill = theme.skills.find(({ id }) => id === skillId);
  if (!skill) return filters;
  filters.skillId = skill.id;

  const objectiveId = firstParameter(parameters.objectiveId);
  const objective = skill.objectives.find(({ id }) => id === objectiveId);
  if (!objective) return filters;
  filters.objectiveId = objective.id;

  const weekId = firstParameter(parameters.weekId);
  const week = objective.weeks.find(({ id }) => id === weekId);
  if (!week) return filters;
  filters.weekId = week.id;

  const lessonId = firstParameter(parameters.lessonId);
  const lesson = week.lessons.find(({ id }) => id === lessonId);
  if (lesson) filters.lessonId = lesson.id;

  return filters;
}

export default async function ReviewedActivitiesPage({
  searchParams,
}: ReviewedActivitiesPageProps) {
  const parameters = await searchParams;
  const library = await loadCachedReviewedActivityLibrary();
  const initialFilters = initialFiltersFromParameters(parameters);

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

        <ReviewedActivityLibrary
          initialBatches={library}
          initialFilters={initialFilters}
        />
      </section>
    </AppShell>
  );
}
