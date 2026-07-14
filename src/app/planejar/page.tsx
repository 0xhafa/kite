import type { Metadata } from "next";
import Link from "next/link";

import curriculumData from "../../../data/curriculum.json";
import { CurriculumNavigator } from "@/components/curriculum/curriculum-navigator";
import { adaptCurriculum } from "@/domain/curriculum-adapter";

export const metadata: Metadata = {
  title: "Planejar atividades | Kite",
  description: "Seleção curricular e configuração do grupo de atividades pedagógicas.",
};

const curriculum = adaptCurriculum(curriculumData);

export default function PlanPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        className="sr-only rounded-md bg-surface px-4 py-3 font-bold focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
        href="#conteudo"
      >
        Ir para o conteúdo
      </a>

      <header className="border-b-2 border-border bg-surface">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link
            className="rounded-md text-xl font-black tracking-[-0.03em] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus"
            href="/"
          >
            Kite
          </Link>
          <BadgeLabel />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14" id="conteudo">
        <CurriculumNavigator curriculum={curriculum} />
      </main>
    </div>
  );
}

function BadgeLabel() {
  return (
    <span className="rounded-pill bg-neutral-soft px-3 py-2 text-caption font-extrabold uppercase tracking-[0.08em] text-muted">
      Planejamento
    </span>
  );
}
