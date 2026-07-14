import type { Curriculum } from "../../domain/curriculum";
import { curriculumSchema } from "../../domain/curriculum";

import type { KiteDatabase } from "../client";
import { lessons, objectives, skills, themes, weeks } from "../schema";

export class CurriculumRepository {
  constructor(private readonly db: KiteDatabase) {}

  async importCurriculum(input: unknown): Promise<Curriculum> {
    const curriculum = curriculumSchema.parse(input);

    await this.db.transaction(async (transaction) => {
      for (const theme of curriculum.themes) {
        await transaction.insert(themes).values({
          id: theme.id,
          slug: theme.id,
          name: theme.name,
          description: theme.description,
          status: "enabled",
          curriculumVersion: curriculum.version,
        });

        for (const [skillPosition, skill] of theme.skills.entries()) {
          await transaction.insert(skills).values({
            id: skill.id,
            themeId: theme.id,
            name: skill.name,
            description: skill.description,
            position: skillPosition,
          });

          for (const [objectivePosition, objective] of skill.objectives.entries()) {
            await transaction.insert(objectives).values({
              id: objective.id,
              skillId: skill.id,
              name: objective.name,
              priorityStatement: objective.priorityStatement,
              position: objectivePosition,
            });

            for (const [weekPosition, week] of objective.weeks.entries()) {
              await transaction.insert(weeks).values({
                id: week.id,
                objectiveId: objective.id,
                number: week.number,
                title: week.title,
                contentSummary: week.contentSummary,
                position: weekPosition,
              });

              for (const [lessonPosition, lesson] of week.lessons.entries()) {
                await transaction.insert(lessons).values({
                  ...lesson,
                  weekId: week.id,
                  position: lessonPosition,
                });
              }
            }
          }
        }
      }
    });

    return curriculum;
  }
}
