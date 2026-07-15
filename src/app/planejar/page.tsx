import type { Metadata } from "next";

import curriculumData from "../../../data/curriculum.json";
import { PlanningWorkspace } from "@/components/curriculum/planning-workspace";
import { adaptCurriculum } from "@/domain/curriculum-adapter";
import { loadPersistedPlanningContext } from "@/server/generation/integrated-flow";

export const metadata: Metadata = {
  title: "Planejar atividades | Kite",
  description: "Seleção curricular e configuração do grupo de atividades pedagógicas.",
};

const curriculum = adaptCurriculum(curriculumData);

type PlanPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParameter(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PlanPage({ searchParams }: PlanPageProps) {
  const parameters = await searchParams;
  const batchId = firstParameter(parameters.lote);
  const persistedContext = batchId
    ? await loadPersistedPlanningContext(batchId).catch(() => undefined)
    : undefined;

  return (
    <PlanningWorkspace
      curriculum={curriculum}
      initialModelSelection={persistedContext?.modelSelection}
      initialSelection={persistedContext?.selection}
      reviewBatchId={persistedContext?.batchId}
    />
  );
}
