import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
const [tool, ...args] = process.argv.slice(2);
const tools = {
  next: "next/dist/bin/next",
  vitest: "vitest/vitest.mjs",
  prisma: "prisma/build/index.js",
  tsx: "tsx/dist/cli.mjs",
  eslint: "eslint/bin/eslint.js",
  tsc: "typescript/bin/tsc",
};
if (!(tool in tools)) throw new Error("Unsupported tool");
const temporary = resolve(".data/tmp");
mkdirSync(temporary, { recursive: true });
const swcCache = resolve(".data/swc");
mkdirSync(swcCache, { recursive: true });
const child = spawn(
  process.execPath,
  [resolve("node_modules", tools[tool]), ...args],
  {
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      TEMP: temporary,
      TMP: temporary,
      SWC_NATIVE_BINDING_CACHE: swcCache,
      PRISMA_HIDE_UPDATE_MESSAGE: "1",
      NEXT_TELEMETRY_DISABLED: "1",
      ...(process.platform === "win32" ? { OPSVISION_WASM: "true" } : {}),
      ...(tool === "tsx" && process.platform === "win32" ? { NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require=${resolve("scripts/windows-userinfo-fallback.cjs")}`.trim() } : {}),
    },
  },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
process.on("SIGINT", () => child.kill());
process.on("SIGTERM", () => child.kill());
