import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { startBot } from "./src/bot/index";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);

async function main() {
  console.log(`[server] database: ${process.env.DATABASE_PATH}`);
  console.log(`[server] qdrant collection: ${process.env.QDRANT_COLLECTION}`);

  // Start Telegram bot
  await startBot();

  // Start Next.js
  const app = next({ dev });
  const handle = app.getRequestHandler();
  await app.prepare();

  createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    handle(req, res, parsedUrl);
  }).listen(port, () => {
    console.log(`[server] ready on http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error("[server] fatal:", err);
  process.exit(1);
});
