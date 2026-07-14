import { createClient, type Client, type Config } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "./schema";

export type KiteDatabase = LibSQLDatabase<typeof schema>;

export function createKiteDatabase(client: Client): KiteDatabase {
  return drizzle(client, { schema });
}

export function createLocalDatabase(
  config: Config = {
    url: process.env.DATABASE_URL ?? "file:.data/kite.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
): { client: Client; db: KiteDatabase } {
  const client = createClient(config);

  return { client, db: createKiteDatabase(client) };
}
