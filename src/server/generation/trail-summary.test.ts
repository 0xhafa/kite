import { describe, expect, it } from "vitest";

import curriculumData from "../../../data/curriculum.json";
import { adaptCurriculum } from "@/domain/curriculum-adapter";

import { buildTrailSummary, type TrailBatchCounts } from "./trail-summary";

const curriculum = adaptCurriculum({
  version: "test",
  themes: [
    {
      id: "fonemas",
      name: "Fonemas",
      skills: [
        {
          id: "habilidade-1",
          name: "Habilidade 1",
          objectives: [
            {
              id: "objetivo-1",
              name: "Objetivo 1",
              weeks: [
                {
                  id: "semana-1",
                  number: 1,
                  title: "Semana 1",
                  lessons: [
                    {
                      id: "aula-1",
                      number: 1,
                      specificObjective: "Primeiro objetivo específico",
                      content: "Primeiro conteúdo",
                    },
                    {
                      id: "aula-2",
                      number: 2,
                      specificObjective: "Segundo objetivo específico",
                      content: "Segundo conteúdo",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});

function batch(
  lessonId: string,
  totalActivities: number,
  reviewedActivities: number,
  themeId = "fonemas",
): TrailBatchCounts {
  return {
    lesson: { id: lessonId },
    reviewedActivities: Array.from({ length: reviewedActivities }),
    theme: { id: themeId },
    totalActivities,
  };
}

describe("resumo da trilha", () => {
  it("percorre as 80 aulas de Fonemas na ordem do currículo canônico", () => {
    const canonicalCurriculum = adaptCurriculum(curriculumData);
    const summary = buildTrailSummary(canonicalCurriculum, "fonemas", []);
    const lessonIds = summary.theme.skills.flatMap((skill) =>
      skill.objectives.flatMap((objective) =>
        objective.weeks.flatMap((week) => week.lessons.map(({ id }) => id)),
      ),
    );
    const canonicalLessonIds = canonicalCurriculum.themes[0]?.skills.flatMap((skill) =>
      skill.objectives.flatMap((objective) =>
        objective.weeks.flatMap((week) => week.lessons.map(({ id }) => id)),
      ),
    );

    expect(summary.theme.skills).toHaveLength(4);
    expect(summary.theme.skills.flatMap(({ objectives }) => objectives)).toHaveLength(16);
    expect(summary.theme.skills.flatMap(({ objectives }) =>
      objectives.flatMap(({ weeks }) => weeks),
    )).toHaveLength(16);
    expect(summary.totalLessons).toBe(80);
    expect(lessonIds).toEqual(canonicalLessonIds);
  });

  it("mantém todas as aulas na ordem canônica e explicita contagens zeradas", () => {
    const summary = buildTrailSummary(curriculum, "fonemas", []);
    const lessons = summary.theme.skills[0]?.objectives[0]?.weeks[0]?.lessons;

    expect(summary.totalLessons).toBe(2);
    expect(summary.generatedActivities).toBe(0);
    expect(summary.reviewedActivities).toBe(0);
    expect(lessons).toEqual([
      expect.objectContaining({
        id: "aula-1",
        generatedActivities: 0,
        reviewedActivities: 0,
      }),
      expect.objectContaining({
        id: "aula-2",
        generatedActivities: 0,
        reviewedActivities: 0,
      }),
    ]);
  });

  it("soma lotes diferentes da mesma aula sem duplicar a aula", () => {
    const summary = buildTrailSummary(curriculum, "fonemas", [
      batch("aula-1", 3, 1),
      batch("aula-1", 2, 2),
      batch("aula-2", 4, 0, "outro-tema"),
    ]);
    const lessons = summary.theme.skills[0]?.objectives[0]?.weeks[0]?.lessons;

    expect(summary.totalLessons).toBe(2);
    expect(summary.generatedActivities).toBe(5);
    expect(summary.reviewedActivities).toBe(3);
    expect(lessons).toHaveLength(2);
    expect(lessons?.[0]).toEqual(expect.objectContaining({
      id: "aula-1",
      generatedActivities: 5,
      reviewedActivities: 3,
    }));
    expect(lessons?.[1]).toEqual(expect.objectContaining({
      id: "aula-2",
      generatedActivities: 0,
      reviewedActivities: 0,
    }));
  });
});
