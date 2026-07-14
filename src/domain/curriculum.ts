import { z } from "zod";

import {
  identifierSchema,
  nonEmptyTextSchema,
  positiveIntegerSchema,
} from "./shared";

const optionalTextSchema = nonEmptyTextSchema.optional();

export const lessonSchema = z
  .object({
    id: identifierSchema,
    number: positiveIntegerSchema,
    specificObjective: nonEmptyTextSchema,
    content: nonEmptyTextSchema,
    defaultDurationMinutes: positiveIntegerSchema.optional(),
    templateId: identifierSchema.optional(),
  })
  .strict();

export const weekSchema = z
  .object({
    id: identifierSchema,
    number: positiveIntegerSchema,
    title: nonEmptyTextSchema,
    contentSummary: optionalTextSchema,
    lessons: z.array(lessonSchema).min(1),
  })
  .strict();

export const objectiveSchema = z
  .object({
    id: identifierSchema,
    name: nonEmptyTextSchema,
    priorityStatement: optionalTextSchema,
    weeks: z.array(weekSchema).min(1),
  })
  .strict();

export const skillSchema = z
  .object({
    id: identifierSchema,
    name: nonEmptyTextSchema,
    description: optionalTextSchema,
    objectives: z.array(objectiveSchema).min(1),
  })
  .strict();

export const themeSchema = z
  .object({
    id: identifierSchema,
    name: nonEmptyTextSchema,
    description: optionalTextSchema,
    skills: z.array(skillSchema).min(1),
  })
  .strict();

export const curriculumSchema = z
  .object({
    version: nonEmptyTextSchema,
    themes: z.array(themeSchema).min(1),
  })
  .strict()
  .superRefine((curriculum, context) => {
    const identifiers = new Map<string, Array<string | number>>();

    const registerIdentifier = (id: string, path: Array<string | number>) => {
      const previousPath = identifiers.get(id);

      if (previousPath) {
        context.addIssue({
          code: "custom",
          message: `ID duplicado; primeira ocorrência em ${previousPath.join(".")}`,
          path,
        });
        return;
      }

      identifiers.set(id, path);
    };

    curriculum.themes.forEach((theme, themeIndex) => {
      registerIdentifier(theme.id, ["themes", themeIndex, "id"]);

      theme.skills.forEach((skill, skillIndex) => {
        registerIdentifier(skill.id, ["themes", themeIndex, "skills", skillIndex, "id"]);

        skill.objectives.forEach((objective, objectiveIndex) => {
          registerIdentifier(objective.id, [
            "themes",
            themeIndex,
            "skills",
            skillIndex,
            "objectives",
            objectiveIndex,
            "id",
          ]);

          objective.weeks.forEach((week, weekIndex) => {
            registerIdentifier(week.id, [
              "themes",
              themeIndex,
              "skills",
              skillIndex,
              "objectives",
              objectiveIndex,
              "weeks",
              weekIndex,
              "id",
            ]);

            week.lessons.forEach((lesson, lessonIndex) => {
              registerIdentifier(lesson.id, [
                "themes",
                themeIndex,
                "skills",
                skillIndex,
                "objectives",
                objectiveIndex,
                "weeks",
                weekIndex,
                "lessons",
                lessonIndex,
                "id",
              ]);
            });
          });
        });
      });
    });
  });

export const themeStatusSchema = z.enum(["enabled", "disabled"]);

export const themeCatalogEntrySchema = z
  .object({
    id: identifierSchema,
    slug: identifierSchema,
    name: nonEmptyTextSchema,
    description: optionalTextSchema,
    status: themeStatusSchema,
    curriculumVersion: nonEmptyTextSchema,
  })
  .strict();

export type Lesson = z.infer<typeof lessonSchema>;
export type Week = z.infer<typeof weekSchema>;
export type Objective = z.infer<typeof objectiveSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type Curriculum = z.infer<typeof curriculumSchema>;
export type ThemeStatus = z.infer<typeof themeStatusSchema>;
export type ThemeCatalogEntry = z.infer<typeof themeCatalogEntrySchema>;
