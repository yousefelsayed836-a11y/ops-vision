import "dotenv/config";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { Client } from "pg";

const projectUrl = "http://127.0.0.1:3001";
const databaseDir = resolve('.data','pglite-restored-from-dump-20261022');
let databaseProcess;
let webProcess;
let notificationProcess;
let videoProcess;

async function databaseReady() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 1200 });
  try {
    await client.connect();
    const result = await client.query('SELECT COUNT(*)::int AS count FROM "User"');
    return result.rows[0].count;
  } catch {
    return null;
  } finally {
    await client.end().catch(() => {});
  }
}

async function waitForDatabase() {
  for (let attempt = 0; attempt < 30; attempt++) {
    const count = await databaseReady();
    if (count !== null) return count;
    if (databaseProcess?.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Local account database did not start on port 51214.");
}

async function waitForWebsite() {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (webProcess && webProcess.exitCode !== null) break;
    try {
      const response = await fetch(`${projectUrl}/ar/login`, { signal: AbortSignal.timeout(2500) });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("The login page did not respond on port 3001.");
}

async function websiteReady() {
  try {
    const response = await fetch(`${projectUrl}/ar/login`, { signal: AbortSignal.timeout(2500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  let accountCount = await databaseReady();
  if (accountCount === null) {
    console.log("Starting the local account database...");
    databaseProcess = spawn(process.execPath, ["scripts/pglite-dev.mjs", "--development-only"], { stdio: "inherit", windowsHide: true, env:{...process.env,OPSVISION_DB_DIR:databaseDir} });
    accountCount = await waitForDatabase();
  }
  console.log(`Account database ready (${accountCount} users).`);
  if (accountCount !== 3) throw new Error(`Expected three demo accounts, found ${accountCount}; refusing to use a different database.`);
  if (await websiteReady()) {
    console.log("Using the frontend already running on port 3001.");
  } else {
    webProcess = spawn(process.execPath, ["scripts/run.mjs", "next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3001"], {
      stdio: "inherit",
      windowsHide: true,
      env: { ...process.env, APP_URL:projectUrl, BETTER_AUTH_URL:projectUrl, OPSVISION_DIST_DIR: process.env.OPSVISION_DIST_DIR ?? ".next-verify-3001" },
    });
    await waitForWebsite();
  }
  console.log(`OpsVision login page responded: ${projectUrl}/ar/login`);
  notificationProcess=spawn(process.execPath,['scripts/run.mjs','tsx','scripts/notification-worker.ts'],{stdio:'inherit',windowsHide:true,env:process.env});
  const bundledPython=resolve(process.env.USERPROFILE??'', '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
  const visionPath=resolve('.data/vision-python');
  videoProcess=spawn(process.execPath,['scripts/run.mjs','tsx','scripts/video-worker.ts'],{stdio:'inherit',windowsHide:true,env:{...process.env,OPSVISION_PYTHON:process.env.OPSVISION_PYTHON??(existsSync(bundledPython)?bundledPython:'python'),PYTHONPATH:existsSync(visionPath)?visionPath:process.env.PYTHONPATH}});
  if (webProcess) {
    const code = await new Promise((resolve) => webProcess.on("exit", resolve));
    notificationProcess?.kill();
    videoProcess?.kill();
    databaseProcess?.kill();
    if (code !== 0) throw new Error(`Frontend stopped with exit code ${code}.`);
  } else if (databaseProcess) {
    await new Promise((resolve) => databaseProcess.on("exit", resolve));
  } else {
    await new Promise((resolve) => notificationProcess.on("exit", resolve));
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
  webProcess?.kill(signal);
  databaseProcess?.kill(signal);
  notificationProcess?.kill(signal);
  videoProcess?.kill(signal);
});
main().catch((error) => {
  console.error(error.message);
  webProcess?.kill();
  databaseProcess?.kill();
  notificationProcess?.kill();
  videoProcess?.kill();
  process.exitCode = 1;
});
