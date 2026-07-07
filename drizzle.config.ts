import type { Config } from "drizzle-kit";
import { loadEnv } from "./src/lib/load-env";

loadEnv();

const databasePath = process.env.DATABASE_PATH?.trim();
if (!databasePath) {
  throw new Error(
    "DATABASE_PATH не задан. Задайте в .env.{APP_ENV}.local перед db:migrate (см. Docs/spec.md §7.1)."
  );
}

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: databasePath,
  },
} satisfies Config;
