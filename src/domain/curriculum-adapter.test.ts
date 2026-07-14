import { describe, expect, it } from "vitest";

import fixture from "../../data/curriculum.fixture.json";
import { adaptCurriculum, CurriculumAdapterError } from "./curriculum-adapter";

describe("adaptador curricular", () => {
  it("valida a fixture e preserva a ordem canônica", () => {
    const curriculum = adaptCurriculum(fixture);
    const objective = curriculum.themes[0].skills[0].objectives[0];

    expect(curriculum.themes[0].skills[0].id).toBe("fixture-habilidade-01");
    expect(objective.weeks.map((week) => week.id)).toEqual([
      "fixture-semana-01",
      "fixture-semana-02",
    ]);
    expect(objective.weeks[1].lessons.map((lesson) => lesson.id)).toEqual([
      "fixture-aula-02",
      "fixture-aula-03",
    ]);
  });

  it("indica o caminho quando uma aula não possui conteúdo", () => {
    const invalid = structuredClone(fixture);
    Reflect.deleteProperty(invalid.themes[0].skills[0].objectives[0].weeks[1].lessons[0], "content");

    try {
      adaptCurriculum(invalid);
      throw new Error("a fixture inválida deveria falhar");
    } catch (error) {
      expect(error).toBeInstanceOf(CurriculumAdapterError);
      expect(error).toMatchObject({
        issues: [
          expect.objectContaining({
            path: [
              "themes", 0, "skills", 0, "objectives", 0, "weeks", 1,
              "lessons", 0, "content",
            ],
          }),
        ],
      });
      expect((error as Error).message).toContain(
        "O JSON curricular é inválido. Revise 1 problema estrutural.",
      );
      expect((error as Error).message).toContain(
        "themes[0].skills[0].objectives[0].weeks[1].lessons[0].content",
      );
    }
  });

  it("recusa IDs duplicados e aponta a segunda ocorrência", () => {
    const invalid = structuredClone(fixture);
    invalid.themes[0].skills[0].objectives[0].weeks[1].lessons[1].id =
      invalid.themes[0].skills[0].objectives[0].weeks[0].lessons[0].id;

    try {
      adaptCurriculum(invalid);
      throw new Error("uma fixture com ID duplicado deveria falhar");
    } catch (error) {
      expect(error).toBeInstanceOf(CurriculumAdapterError);
      expect(error).toMatchObject({
        issues: [
          expect.objectContaining({
            path: [
              "themes", 0, "skills", 0, "objectives", 0, "weeks", 1,
              "lessons", 1, "id",
            ],
          }),
        ],
      });
      expect((error as Error).message).toContain("ID duplicado");
      expect((error as Error).message).toContain(
        "themes[0].skills[0].objectives[0].weeks[1].lessons[1].id",
      );
    }
  });
});
