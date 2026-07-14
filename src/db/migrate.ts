import { resolve } from "node:path";

import { migrate } from "drizzle-orm/libsql/migrator";

import type { KiteDatabase } from "./client";

export async function migrateDatabase(
  db: KiteDatabase,
  migrationsFolder = resolve(process.cwd(), "src/db/migrations"),
): Promise<void> {
  await migrate(db, { migrationsFolder });
}
