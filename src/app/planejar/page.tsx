import type { Metadata } from "next";

import curriculumData from "../../../data/curriculum.json";
import { PlanningWorkspace } from "@/components/curriculum/planning-workspace";
import { adaptCurriculum } from "@/domain/curriculum-adapter";

export const metadata: Metadata = {
  title: "Planejar atividades | Kite",
  description: "Seleção curricular e configuração do grupo de atividades pedagógicas.",
};

const curriculum = adaptCurriculum(curriculumData);

export default function PlanPage() {
  return <PlanningWorkspace curriculum={curriculum} />;
}
