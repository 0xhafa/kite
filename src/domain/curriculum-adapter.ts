import { curriculumSchema, type Curriculum } from "./curriculum";

/** Valida a entrada curricular na fronteira e a expõe no contrato canônico. */
export function adaptCurriculum(input: unknown): Curriculum {
  return curriculumSchema.parse(input);
}
