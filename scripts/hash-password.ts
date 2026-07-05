/**
 * Утилита для настройки пароля админки.
 * Использование: npm run admin:hash-password -- "мойПароль"
 * Выводит bcrypt-хеш в base64 — его нужно положить в .env как ADMIN_PASSWORD_HASH_BASE64.
 *
 * Хеш кодируется в base64, а не хранится как есть, потому что Next.js при загрузке .env
 * интерпретирует `$` в значении как ссылку на другую переменную окружения (`$2b`, `$10`, ...)
 * и портит обычный bcrypt-хеш.
 */
import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  console.error("Использование: npm run admin:hash-password -- \"мойПароль\"");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
const hashBase64 = Buffer.from(hash, "utf8").toString("base64");
console.log("\nADMIN_PASSWORD_HASH_BASE64=" + hashBase64 + "\n");
console.log("Скопируйте строку выше в .env.development.local (или .env.production.local на сервере)");
