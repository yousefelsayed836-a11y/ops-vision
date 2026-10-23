import "dotenv/config";
import { spawn } from "node:child_process";
const url = new URL(process.env.TEST_DATABASE_URL ?? "http://invalid");
if (
  !url.pathname.endsWith("_test") &&
  !(url.hostname === "127.0.0.1" && url.port === "51224")
)
  throw new Error("Refusing to migrate a non-test database");
const child = spawn(
  process.execPath,
  ["scripts/run.mjs", "prisma", "migrate", "deploy"],
  {
    stdio: "inherit",
    windowsHide: true,
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
  },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
