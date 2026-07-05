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
] as const;

/** Проверка обязательных переменных при старте server.ts. */
export function validateEnv(): void {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]?.trim());
  if (missing.length === 0) return;

  const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";
  throw new Error(
    `Не заданы обязательные переменные окружения: ${missing.join(", ")}.\n` +
      `APP_ENV=${appEnv}. Проверьте .env.${appEnv}.local (см. Docs/spec.md §7.1).`
  );
}
