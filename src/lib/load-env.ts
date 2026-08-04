import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function loadEnvFile(relativePath: string, override: boolean): void {
  const path = resolve(root, relativePath);
  if (existsSync(path)) {
    config({ path, override });
  }
}

/**
 * Загрузка переменных окружения в том же порядке, что и Next.js,
 * плюс поддержка APP_ENV=staging через `.env.staging` / `.env.staging.local`.
 *
 * APP_ENV — какой набор секретов брать (development | staging | production).
 * NODE_ENV — режим рантайма Next.js (development | production).
 */
export function loadEnv(): void {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const appEnv = process.env.APP_ENV ?? nodeEnv;

  loadEnvFile(".env", false);
  loadEnvFile(".env.local", true);

  if (appEnv === "staging") {
    loadEnvFile(".env.staging", true);
    loadEnvFile(".env.staging.local", true);
  } else if (appEnv === "production" || nodeEnv === "production") {
    loadEnvFile(".env.production", true);
    loadEnvFile(".env.production.local", true);
  } else {
    loadEnvFile(".env.development", true);
    loadEnvFile(".env.development.local", true);
  }
}

const REQUIRED_VARS = [
  "TG_BOT_TOKEN",
  "MISTRAL_API_KEY",
  "ADMIN_PASSWORD_HASH_BASE64",
  "SESSION_SECRET",
  "TEACHER_CONTACT_URL",
  "DATABASE_PATH",
  "QDRANT_COLLECTION",
] as const;

/** Короткий маркер окружения: development → dev, production → prod, staging → staging. */
const ENV_MARKERS: Record<string, string> = {
  development: "dev",
  production: "prod",
  staging: "staging",
};

/** Проверка обязательных переменных при старте server.ts. */
export function validateEnv(): void {
  const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";

  const missing = REQUIRED_VARS.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Не заданы обязательные переменные окружения: ${missing.join(", ")}.\n` +
        `APP_ENV=${appEnv}. Проверьте .env.${appEnv}.local (см. Docs/spec.md §7.1).`
    );
  }

  // Защита от перепутывания окружений: dev и prod живут на одной машине с общим
  // Qdrant, и опечатка в .env молча направила бы dev-данные в прод (и наоборот).
  const marker = ENV_MARKERS[appEnv];
  if (!marker) return;

  const collection = process.env.QDRANT_COLLECTION!;
  if (!collection.endsWith(`_${marker}`)) {
    throw new Error(
      `QDRANT_COLLECTION="${collection}" не соответствует окружению APP_ENV=${appEnv}: ` +
        `имя коллекции должно оканчиваться на "_${marker}" (см. Docs/spec.md §7.1).`
    );
  }

  const dbPath = process.env.DATABASE_PATH!;
  const dbFileName = dbPath.split("/").pop() ?? dbPath;
  if (!dbFileName.includes(marker)) {
    throw new Error(
      `DATABASE_PATH="${dbPath}" не соответствует окружению APP_ENV=${appEnv}: ` +
        `имя файла базы должно содержать "${marker}" (см. Docs/spec.md §7.1).`
    );
  }
}
