import { describe, expect, it } from "vitest";

import curriculumData from "../../data/curriculum.json";
import { adaptCurriculum } from "./curriculum-adapter";
import {
  emptyCurriculumSelection,
  findSelectedLesson,
  getAvailableLessons,
  getAvailableObjectives,
  getAvailableSkills,
  getAvailableWeeks,
  isCurriculumSelectionComplete,
  selectCurriculumLevel,
  type CurriculumSelection,
} from "./curriculum-navigation";

const curriculum = adaptCurriculum(curriculumData);
const theme = curriculum.themes[0];
const skill = theme.skills[0];
const objective = skill.objectives[0];
const week = objective.weeks[0];
const lesson = week.lessons[0];

const completeSelection: CurriculumSelection = {
  themeId: theme.id,
  skillId: skill.id,
  objectiveId: objective.id,
  weekId: week.id,
  lessonId: lesson.id,
};

describe("navegação curricular", () => {
  it("expõe somente opções pertencentes ao caminho selecionado", () => {
    expect(getAvailableSkills(curriculum, { themeId: theme.id })).toHaveLength(4);
    expect(getAvailableObjectives(curriculum, completeSelection)).toEqual(skill.objectives);
    expect(getAvailableWeeks(curriculum, completeSelection)).toEqual(objective.weeks);
    expect(getAvailableLessons(curriculum, completeSelection)).toEqual(week.lessons);
  });

  it("não expõe opções quando um nível não pertence ao nível anterior", () => {
    const otherSkill = theme.skills[1];
    const inconsistentSelection = {
      ...completeSelection,
      skillId: otherSkill.id,
    };

    expect(getAvailableObjectives(curriculum, inconsistentSelection)).toEqual(
      otherSkill.objectives,
    );
    expect(getAvailableWeeks(curriculum, inconsistentSelection)).toEqual([]);
    expect(getAvailableLessons(curriculum, inconsistentSelection)).toEqual([]);
    expect(findSelectedLesson(curriculum, inconsistentSelection)).toBeUndefined();
  });

  it("limpa os níveis inferiores ao alterar uma escolha", () => {
    expect(selectCurriculumLevel(completeSelection, "objectiveId", "novo-objetivo")).toEqual({
      themeId: theme.id,
      skillId: skill.id,
      objectiveId: "novo-objetivo",
      weekId: null,
      lessonId: null,
    });

    expect(selectCurriculumLevel(completeSelection, "themeId", "outro-tema")).toEqual({
      themeId: "outro-tema",
      skillId: null,
      objectiveId: null,
      weekId: null,
      lessonId: null,
    });
  });

  it("só libera o avanço para uma aula concreta do caminho selecionado", () => {
    expect(isCurriculumSelectionComplete(curriculum, emptyCurriculumSelection)).toBe(false);
    expect(
      isCurriculumSelectionComplete(curriculum, { ...completeSelection, lessonId: null }),
    ).toBe(false);
    expect(isCurriculumSelectionComplete(curriculum, completeSelection)).toBe(true);
    expect(findSelectedLesson(curriculum, completeSelection)).toEqual(lesson);
  });
});
