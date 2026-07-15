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
      skills: Array.from({ length: 4 }, (_, skillIndex) => {
        const skillNumber = skillIndex + 1;

        return {
          id: `habilidade-${skillNumber}`,
          name: `Habilidade curricular ${skillNumber}`,
          objectives: [
            {
              id: `objetivo-${skillNumber}`,
              name: `Objetivo curricular ${skillNumber}`,
              weeks: [
                {
                  id: `semana-${skillNumber}`,
                  number: skillNumber,
                  title: `Semana ${skillNumber}`,
                  lessons:
                    skillIndex === 0
                      ? [
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
                        ]
                      : [
                          {
                            id: `aula-${skillNumber}`,
                            number: skillNumber,
                            pendingActivities: 0,
                            reviewedActivities: 0,
                            specificObjective: `Praticar habilidade ${skillNumber}`,
                          },
                        ],
                },
              ],
            },
          ],
        };
      }),
    },
    totalLessons: 6,
  };
}

describe("resumo da trilha", () => {
  it("renderiza quatro controles de habilidade expandidos por padrão", () => {
    const html = renderToStaticMarkup(
      createElement(TrailSummary, { summary: createSummary() }),
    );

    expect(html.match(/data-testid="trail-skill-toggle"/g)).toHaveLength(4);
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(4);
    expect(html.match(/>Recolher grupo</g)).toHaveLength(4);

    for (let skillNumber = 1; skillNumber <= 4; skillNumber += 1) {
      expect(html).toContain(
        `aria-controls="conteudo-habilidade-trilha-habilidade-${skillNumber}"`,
      );
      expect(html).toContain(
        `aria-label="Recolher grupo Habilidade ${skillNumber}: Habilidade curricular ${skillNumber}"`,
      );
      expect(html).toContain(
        `id="conteudo-habilidade-trilha-habilidade-${skillNumber}"`,
      );
    }

    expect(html).not.toContain("hidden=\"\"");
  });

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
