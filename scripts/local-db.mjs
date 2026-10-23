import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
mkdirSync(".data", { recursive: true });
const child = spawn(
  process.execPath,
  [
    "scripts/run.mjs",
    "prisma",
    "dev",
    "--name",
    "opsvision",
    "--port",
    "51213",
    "--db-port",
    "51214",
    "--shadow-db-port",
    "51215",
  ],
  {
    env: {
      ...process.env,
      XDG_DATA_HOME: resolve(".data"),
      PRISMA_HIDE_UPDATE_MESSAGE: "1",
    },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  },
);
let ready = false;
for (const stream of [child.stdout, child.stderr])
  stream.on("data", (chunk) => {
    const text = chunk.toString();
    if (!ready && /ready|started|running|51214|localhost/i.test(text)) {
      ready = true;
      console.log(
        "Local PostgreSQL development server starting; connection details suppressed.",
      );
    }
    if (/error|failed/i.test(text))
      console.error(
        text.replace(
          /(?:postgres(?:ql)?|prisma\+postgres):\/\/\S+/g,
          "[REDACTED DATABASE URL]",
        ),
      );
  });
child.on("exit", (code) => {
  console.log("Local database process ended:", code);
  process.exitCode = code ?? 1;
});
process.on("SIGINT", () => child.kill());
process.on("SIGTERM", () => child.kill());
