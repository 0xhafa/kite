import { describe, expect, it } from "vitest";

import curriculumData from "../../data/curriculum.json";
import { parseLessonContent } from "./lesson-content";

describe("conteúdo estruturado da aula", () => {
  it("separa o título e as atividades", () => {
    const result = parseLessonContent(
      "Aula 1: Escuta do fonema /s/.\nAtividade 1: Cantiga: A Canoa Virou\nCantar com a turma.\nAtividade 2 – Pescaria das palavras\nSeparar as figuras.",
    );

    expect(result).toEqual({
      title: "Escuta do fonema /s/.",
      introduction: "",
      activities: [
        {
          number: 1,
          title: "Cantiga: A Canoa Virou",
          description: "Cantar com a turma.",
        },
        {
          number: 2,
          title: "Pescaria das palavras",
          description: "Separar as figuras.",
        },
      ],
    });
  });

  it("aceita variações de espaçamento e remove rodapés genéricos", () => {
    const result = parseLessonContent(
      "Aula 2 – Relação entre som e letra\nAtividade1: Retomada\nRelembrar a cantiga.\n– Ficha de atividade impressa (5 minutos).",
    );

    expect(result.activities).toEqual([
      {
        number: 1,
        title: "Retomada",
        description: "Relembrar a cantiga.",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("Ficha de atividade impressa");
  });

  it("numera uma atividade quando a fonte omite o número", () => {
    const result = parseLessonContent(
      "Aula 2 – Relação entre som e letra\nAtividade – Boliche dos Sons\nOrganizar os pinos.",
    );

    expect(result.activities[0]).toMatchObject({
      number: 1,
      title: "Boliche dos Sons",
    });
  });

  it("preserva um texto sem marcação como introdução", () => {
    expect(parseLessonContent("Explorar o som inicial das palavras.")).toEqual({
      title: "",
      introduction: "Explorar o som inicial das palavras.",
      activities: [],
    });
  });

  it("estrutura todas as aulas da matriz curricular", () => {
    const lessons = curriculumData.themes.flatMap((theme) =>
      theme.skills.flatMap((skill) =>
        skill.objectives.flatMap((objective) =>
          objective.weeks.flatMap((week) => week.lessons),
        ),
      ),
    );

    for (const lesson of lessons) {
      const result = parseLessonContent(lesson.content);

      expect(result.activities.length, lesson.id).toBeGreaterThan(0);
      expect(JSON.stringify(result), lesson.id).not.toContain("Ficha de atividade impressa");
    }
  });
});
