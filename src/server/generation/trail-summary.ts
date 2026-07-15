import type { Curriculum } from "@/domain/curriculum";
import type { ReviewDecisionType } from "@/domain/review";

export type TrailBatchCounts = {
  lesson: { id: string };
  reviewedActivities: ReadonlyArray<{
    decision: { decision: ReviewDecisionType };
  }>;
  theme: { id: string };
  totalActivities: number;
};

export type TrailLessonSummary = {
  id: string;
  number: number;
  pendingActivities: number;
  reviewedActivities: number;
  specificObjective: string;
};

export type TrailSummary = {
  pendingActivities: number;
  reviewedActivities: number;
  theme: {
    id: string;
    name: string;
    skills: Array<{
      id: string;
      name: string;
      objectives: Array<{
        id: string;
        name: string;
        weeks: Array<{
          id: string;
          number: number;
          title: string;
          lessons: TrailLessonSummary[];
        }>;
      }>;
    }>;
  };
  totalLessons: number;
};

type LessonCounts = {
  pendingActivities: number;
  reviewedActivities: number;
};

export function buildTrailSummary(
  curriculum: Curriculum,
  themeId: string,
  batches: readonly TrailBatchCounts[],
): TrailSummary {
  const theme = curriculum.themes.find(({ id }) => id === themeId);
  if (!theme) {
    throw new Error(`O tema curricular “${themeId}” não foi encontrado.`);
  }

  const countsByLesson = new Map<string, LessonCounts>();
  for (const batch of batches) {
    if (batch.theme.id !== theme.id) continue;

    const current = countsByLesson.get(batch.lesson.id) ?? {
      pendingActivities: 0,
      reviewedActivities: 0,
    };
    const reviewedActivities = batch.reviewedActivities.filter(
      ({ decision }) => decision.decision === "approved",
    ).length;
    const pendingActivities = batch.totalActivities - batch.reviewedActivities.length;

    countsByLesson.set(batch.lesson.id, {
      pendingActivities: current.pendingActivities + pendingActivities,
      reviewedActivities: current.reviewedActivities + reviewedActivities,
    });
  }

  let pendingActivities = 0;
  let reviewedActivities = 0;
  let totalLessons = 0;

  const skills = theme.skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    objectives: skill.objectives.map((objective) => ({
      id: objective.id,
      name: objective.name,
      weeks: objective.weeks.map((week) => ({
        id: week.id,
        number: week.number,
        title: week.title,
        lessons: week.lessons.map((lesson) => {
          const counts = countsByLesson.get(lesson.id) ?? {
            pendingActivities: 0,
            reviewedActivities: 0,
          };
          pendingActivities += counts.pendingActivities;
          reviewedActivities += counts.reviewedActivities;
          totalLessons += 1;

          return {
            id: lesson.id,
            number: lesson.number,
            specificObjective: lesson.specificObjective,
            ...counts,
          };
        }),
      })),
    })),
  }));

  return {
    pendingActivities,
    reviewedActivities,
    theme: {
      id: theme.id,
      name: theme.name,
      skills,
    },
    totalLessons,
  };
}
