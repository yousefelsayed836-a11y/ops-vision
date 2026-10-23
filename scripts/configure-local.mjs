import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env"))
  throw new Error(".env already exists; configuration was not overwritten");
writeFileSync(
  ".env",
  `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:51214/postgres\nTEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:51224/postgres\nBETTER_AUTH_SECRET=${randomBytes(48).toString("base64url")}\nBETTER_AUTH_URL=http://localhost:3000\nAPP_URL=http://localhost:3000\nAPP_ENV=development\nALLOW_SIMULATION=true\n`,
  { mode: 0o600 },
);
console.log(
  "Local-only .env created with a random secret. No credentials printed.",
);
