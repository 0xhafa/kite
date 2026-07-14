import { mkdir } from "node:fs/promises";

import curriculumData from "../../data/curriculum.json";
import rulesData from "../../data/rules.json";
import { adaptCurriculum } from "@/domain/curriculum-adapter";
import { loadRuleCatalog } from "@/domain/rules-catalog";
import {
  createLocalDatabase,
  migrateDatabase,
  type KiteDatabase,
} from "@/db";
import { CurriculumRepository } from "@/db/repositories";
import { rules, themes } from "@/db/schema";

type ApplicationDatabase = {
  db: KiteDatabase;
};

const globalDatabase = globalThis as typeof globalThis & {
  kiteApplicationDatabase?: Promise<ApplicationDatabase>;
};

async function initializeApplicationDatabase(): Promise<ApplicationDatabase> {
  const databaseUrl =
  process.env.DATABASE_URL?.trim() || "file:.data/kite.db";

  if (databaseUrl.startsWith("file:")) {
    await mkdir(".data", { recursive: true });
  }

  const { db } = createLocalDatabase({
    url: databaseUrl,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  await migrateDatabase(db);

  const [existingTheme] = await db.select({ id: themes.id }).from(themes).limit(1);
  if (!existingTheme) {
    await new CurriculumRepository(db).importCurriculum(adaptCurriculum(curriculumData));
  }

  const catalog = loadRuleCatalog(rulesData);
  for (const rule of catalog.rules) {
    await db.insert(rules).values({
      id: rule.id,
      version: rule.version,
      title: rule.title,
      description: rule.description,
      applicabilityCondition: rule.applicabilityCondition,
      generationInstruction: rule.generationInstruction,
      validationCriterion: rule.validationCriterion,
      severity: rule.severity,
      origin: rule.origin,
      status: rule.status,
    }).onConflictDoNothing();
  }

  return { db };
}

export function getApplicationDatabase(): Promise<ApplicationDatabase> {
  globalDatabase.kiteApplicationDatabase ??= initializeApplicationDatabase();
  return globalDatabase.kiteApplicationDatabase;
}
