import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { TrailSummary as TrailSummaryData } from "@/server/generation/trail-summary";

import { TrailSummary } from "./trail-summary";

function createSummary(): TrailSummaryData {
  return {
    pendingActivities: 2,
    reviewedActivities: 1,
    theme: {
      id: "fonemas",
      name: "Fonemas",
      skills: [
        {
          id: "habilidade-1",
          name: "Consciência fonológica",
          objectives: [
            {
              id: "objetivo-1",
              name: "Reconhecer sons",
              weeks: [
                {
                  id: "semana-1",
                  number: 1,
                  title: "Semana 1",
                  lessons: [
                    {
                      id: "aula-pendente",
                      number: 1,
                      pendingActivities: 2,
                      reviewedActivities: 0,
                      specificObjective: "Identificar sons iniciais",
                    },
                    {
                      id: "aula-revisada",
                      number: 2,
                      pendingActivities: 0,
                      reviewedActivities: 1,
                      specificObjective: "Comparar sons iniciais",
                    },
                    {
                      id: "aula-vazia",
                      number: 3,
                      pendingActivities: 0,
                      reviewedActivities: 0,
                      specificObjective: "Agrupar sons iniciais",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    totalLessons: 3,
  };
}

describe("chips do resumo da trilha", () => {
  it("usa cores semânticas e omite chips e contêineres com contagens zeradas", () => {
    const html = renderToStaticMarkup(
      createElement(TrailSummary, { summary: createSummary() }),
    );

    expect(html).toContain(
      'class="rounded-pill bg-warning-soft px-3 py-2 text-warning">Pendentes: 2',
    );
    expect(html).toContain(
      'class="rounded-pill bg-success-soft px-3 py-2 text-success">Revisadas: 1',
    );
    expect(html).not.toContain("Pendentes: 0");
    expect(html).not.toContain("Revisadas: 0");
    expect(html.match(/data-testid="trail-lesson-statuses"/g)).toHaveLength(2);
  });
});
