import { describe, expect, it } from "vitest";

import curriculumData from "../../../data/curriculum.json";
import { adaptCurriculum } from "@/domain/curriculum-adapter";
import type { ReviewDecisionType } from "@/domain/review";

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
  decisions: ReviewDecisionType[],
  themeId = "fonemas",
): TrailBatchCounts {
  return {
    lesson: { id: lessonId },
    reviewedActivities: decisions.map((decision) => ({
      decision: { decision },
    })),
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
    expect(summary.pendingActivities).toBe(0);
    expect(summary.reviewedActivities).toBe(0);
    expect(lessons).toEqual([
      expect.objectContaining({
        id: "aula-1",
        pendingActivities: 0,
        reviewedActivities: 0,
      }),
      expect.objectContaining({
        id: "aula-2",
        pendingActivities: 0,
        reviewedActivities: 0,
      }),
    ]);
  });

  it("soma aprovadas e pendentes entre lotes sem contar rejeitadas", () => {
    const summary = buildTrailSummary(curriculum, "fonemas", [
      batch("aula-1", 4, ["approved", "rejected"]),
      batch("aula-1", 2, ["approved", "rejected"]),
      batch("aula-2", 4, [], "outro-tema"),
      batch("aula-ausente", 3, ["approved"]),
    ]);
    const lessons = summary.theme.skills[0]?.objectives[0]?.weeks[0]?.lessons;

    expect(summary.totalLessons).toBe(2);
    expect(summary.pendingActivities).toBe(2);
    expect(summary.reviewedActivities).toBe(2);
    expect(lessons).toHaveLength(2);
    expect(lessons?.[0]).toEqual(expect.objectContaining({
      id: "aula-1",
      pendingActivities: 2,
      reviewedActivities: 2,
    }));
    expect(lessons?.[1]).toEqual(expect.objectContaining({
      id: "aula-2",
      pendingActivities: 0,
      reviewedActivities: 0,
    }));
  });

  it("mantém uma aula com somente rejeições zerada e não conta lotes ausentes", () => {
    const summary = buildTrailSummary(curriculum, "fonemas", [
      batch("aula-2", 2, ["rejected", "rejected"]),
    ]);
    const lesson = summary.theme.skills[0]?.objectives[0]?.weeks[0]?.lessons[1];

    expect(summary.pendingActivities).toBe(0);
    expect(summary.reviewedActivities).toBe(0);
    expect(lesson).toEqual(expect.objectContaining({
      id: "aula-2",
      pendingActivities: 0,
      reviewedActivities: 0,
    }));
  });
});
