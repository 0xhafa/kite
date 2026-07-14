import { describe, expect, it } from "vitest";

import curriculumData from "../../data/curriculum.json";
import { adaptCurriculum } from "./curriculum-adapter";

describe("importação da matriz curricular real", () => {
  it("valida a matriz canônica e importa todas as entidades", () => {
    const curriculum = adaptCurriculum(curriculumData);
    const skills = curriculum.themes.flatMap((theme) => theme.skills);
    const objectives = skills.flatMap((skill) => skill.objectives);
    const weeks = objectives.flatMap((objective) => objective.weeks);
    const lessons = weeks.flatMap((week) => week.lessons);

    expect(curriculum.themes).toHaveLength(1);
    expect(skills).toHaveLength(4);
    expect(objectives).toHaveLength(16);
    expect(weeks).toHaveLength(16);
    expect(lessons).toHaveLength(80);
  });

  it("preserva a ordem, os IDs e os textos literais do arquivo de origem", () => {
    const curriculum = adaptCurriculum(curriculumData);
    const skills = curriculum.themes.flatMap((theme) => theme.skills);
    const objectives = skills.flatMap((skill) => skill.objectives);
    const weeks = objectives.flatMap((objective) => objective.weeks);
    const lessons = weeks.flatMap((week) => week.lessons);
    const sourceLesson = curriculumData.themes[0].skills[1].objectives[3].weeks[0].lessons[2];
    const importedLesson = lessons[37];

    expect({
      first: {
        theme: curriculum.themes[0].id,
        skill: skills[0].id,
        objective: objectives[0].id,
        week: weeks[0].id,
        lesson: lessons[0].id,
      },
      last: {
        theme: curriculum.themes.at(-1)?.id,
        skill: skills.at(-1)?.id,
        objective: objectives.at(-1)?.id,
        week: weeks.at(-1)?.id,
        lesson: lessons.at(-1)?.id,
      },
    }).toEqual({
      first: {
        theme: "fonemas",
        skill: "fonemas-habilidade-01",
        objective: "fonemas-habilidade-01-objetivo-01",
        week: "fonemas-habilidade-01-objetivo-01-semana-01",
        lesson: "fonemas-habilidade-01-objetivo-01-semana-01-aula-01",
      },
      last: {
        theme: "fonemas",
        skill: "fonemas-habilidade-04",
        objective: "fonemas-habilidade-04-objetivo-04",
        week: "fonemas-habilidade-04-objetivo-04-semana-04",
        lesson: "fonemas-habilidade-04-objetivo-04-semana-04-aula-05",
      },
    });
    expect(importedLesson).toEqual(sourceLesson);
  });
});
