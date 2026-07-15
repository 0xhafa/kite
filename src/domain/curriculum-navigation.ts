import { z } from "zod";

import type {
  Curriculum,
  Lesson,
  Objective,
  Skill,
  Theme,
  Week,
} from "./curriculum";
import { identifierSchema } from "./shared";

export const completeCurriculumSelectionSchema = z
  .object({
    themeId: identifierSchema,
    skillId: identifierSchema,
    objectiveId: identifierSchema,
    weekId: identifierSchema,
    lessonId: identifierSchema,
  })
  .strict();

export type CompleteCurriculumSelection = z.infer<
  typeof completeCurriculumSelectionSchema
>;

export type CurriculumSelection = {
  themeId: string | null;
  skillId: string | null;
  objectiveId: string | null;
  weekId: string | null;
  lessonId: string | null;
};

export type CurriculumSelectionLevel = keyof CurriculumSelection;

export const emptyCurriculumSelection: CurriculumSelection = {
  themeId: null,
  skillId: null,
  objectiveId: null,
  weekId: null,
  lessonId: null,
};

export function selectCurriculumLevel(
  selection: CurriculumSelection,
  level: CurriculumSelectionLevel,
  id: string,
): CurriculumSelection {
  switch (level) {
    case "themeId":
      return {
        themeId: id,
        skillId: null,
        objectiveId: null,
        weekId: null,
        lessonId: null,
      };
    case "skillId":
      return {
        ...selection,
        skillId: id,
        objectiveId: null,
        weekId: null,
        lessonId: null,
      };
    case "objectiveId":
      return {
        ...selection,
        objectiveId: id,
        weekId: null,
        lessonId: null,
      };
    case "weekId":
      return {
        ...selection,
        weekId: id,
        lessonId: null,
      };
    case "lessonId":
      return { ...selection, lessonId: id };
  }
}

export function findSelectedTheme(
  curriculum: Curriculum,
  selection: Pick<CurriculumSelection, "themeId">,
): Theme | undefined {
  return curriculum.themes.find((theme) => theme.id === selection.themeId);
}

export function getAvailableSkills(
  curriculum: Curriculum,
  selection: Pick<CurriculumSelection, "themeId">,
): ReadonlyArray<Skill> {
  return findSelectedTheme(curriculum, selection)?.skills ?? [];
}

export function findSelectedSkill(
  curriculum: Curriculum,
  selection: Pick<CurriculumSelection, "themeId" | "skillId">,
): Skill | undefined {
  return getAvailableSkills(curriculum, selection).find((skill) => skill.id === selection.skillId);
}

export function getAvailableObjectives(
  curriculum: Curriculum,
  selection: Pick<CurriculumSelection, "themeId" | "skillId">,
): ReadonlyArray<Objective> {
  return findSelectedSkill(curriculum, selection)?.objectives ?? [];
}

export function findSelectedObjective(
  curriculum: Curriculum,
  selection: Pick<CurriculumSelection, "themeId" | "skillId" | "objectiveId">,
): Objective | undefined {
  return getAvailableObjectives(curriculum, selection).find(
    (objective) => objective.id === selection.objectiveId,
  );
}

export function getAvailableWeeks(
  curriculum: Curriculum,
  selection: Pick<CurriculumSelection, "themeId" | "skillId" | "objectiveId">,
): ReadonlyArray<Week> {
  return findSelectedObjective(curriculum, selection)?.weeks ?? [];
}

export function findSelectedWeek(
  curriculum: Curriculum,
  selection: Pick<
    CurriculumSelection,
    "themeId" | "skillId" | "objectiveId" | "weekId"
  >,
): Week | undefined {
  return getAvailableWeeks(curriculum, selection).find((week) => week.id === selection.weekId);
}

export function getAvailableLessons(
  curriculum: Curriculum,
  selection: Pick<
    CurriculumSelection,
    "themeId" | "skillId" | "objectiveId" | "weekId"
  >,
): ReadonlyArray<Lesson> {
  return findSelectedWeek(curriculum, selection)?.lessons ?? [];
}

export function findSelectedLesson(
  curriculum: Curriculum,
  selection: CurriculumSelection,
): Lesson | undefined {
  return getAvailableLessons(curriculum, selection).find(
    (lesson) => lesson.id === selection.lessonId,
  );
}

export function isCurriculumSelectionComplete(
  curriculum: Curriculum,
  selection: CurriculumSelection,
): boolean {
  return findSelectedLesson(curriculum, selection) !== undefined;
}
