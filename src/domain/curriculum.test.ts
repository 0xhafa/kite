import { describe, expect, it } from "vitest";

import curriculumData from "../../data/curriculum.json";
import { curriculumSchema } from "./curriculum";

describe("contrato curricular", () => {
  it("valida a matriz canônica sem alterar o conteúdo curricular", () => {
    const curriculum = curriculumSchema.parse(curriculumData);
    const lessonCount = curriculum.themes.reduce(
      (themeTotal, theme) =>
        themeTotal +
        theme.skills.reduce(
          (skillTotal, skill) =>
            skillTotal +
            skill.objectives.reduce(
              (objectiveTotal, objective) =>
                objectiveTotal +
                objective.weeks.reduce(
                  (weekTotal, week) => weekTotal + week.lessons.length,
                  0,
                ),
              0,
            ),
          0,
        ),
      0,
    );

    expect(curriculum.version).toBe("1.0");
    expect(curriculum.themes).toHaveLength(1);
    expect(lessonCount).toBe(80);
    expect(curriculum.themes[0].skills[0].objectives[0].weeks[0].lessons[0].specificObjective).toBe(
      curriculumData.themes[0].skills[0].objectives[0].weeks[0].lessons[0].specificObjective,
    );
  });

  it("recusa IDs duplicados e informa o caminho exato", () => {
    const duplicatedCurriculum = structuredClone(curriculumData);
    duplicatedCurriculum.themes[0].skills[0].id = duplicatedCurriculum.themes[0].id;

    const result = curriculumSchema.safeParse(duplicatedCurriculum);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["themes", 0, "skills", 0, "id"],
          }),
        ]),
      );
    }
  });

  it("recusa campos desconhecidos em vez de inferi-los silenciosamente", () => {
    const result = curriculumSchema.safeParse({
      ...curriculumData,
      themeId: "fonemas",
    });

    expect(result.success).toBe(false);
  });
});
