import { mkdir } from "node:fs/promises";

import { createLocalDatabase } from "./client";
import { prepareApplicationDatabase } from "../server/application-database";

async function setupDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim() || "file:.data/kite.db";

  if (databaseUrl.startsWith("file:")) {
    await mkdir(".data", { recursive: true });
  }

  const { client, db } = createLocalDatabase({
    url: databaseUrl,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  try {
    await prepareApplicationDatabase(db);
  } finally {
    client.close();
  }
}

setupDatabase().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
