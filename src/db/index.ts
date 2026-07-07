import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const databasePath = process.env.DATABASE_PATH?.trim();
if (!databasePath) {
  throw new Error(
    "DATABASE_PATH не задан. Проверьте .env.{APP_ENV}.local (см. Docs/spec.md §7.1)."
  );
}

mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });

const sqlite = new Database(databasePath);
export const db = drizzle(sqlite, { schema });

migrate(db, { migrationsFolder: path.join(process.cwd(), "src/db/migrations") });
