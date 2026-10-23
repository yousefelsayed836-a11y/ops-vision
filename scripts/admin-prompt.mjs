import { createInterface } from "node:readline/promises";
import { spawn } from "node:child_process";
if (!process.stdin.isTTY)
  throw new Error("Run this command in an interactive local terminal");
const input = createInterface({ input: process.stdin, output: process.stdout });
const email = await input.question("Administrator email: ");
const name = await input.question("Administrator name: ");
input.close();
process.stdout.write("Password (hidden, at least 12 characters): ");
process.stdin.setRawMode(true);
process.stdin.resume();
let password = "";
try {
  password = await new Promise((resolve, reject) => {
    let value = "";
    const listener = (chunk) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") {
          process.stdin.off("data", listener);
          reject(new Error("Cancelled"));
          return;
        }
        if (character === "\r" || character === "\n") {
          process.stdin.off("data", listener);
          resolve(value);
          return;
        }
        if (character === "\u007f" || character === "\b")
          value = value.slice(0, -1);
        else if (character >= " " && value.length < 128) value += character;
      }
    };
    process.stdin.on("data", listener);
  });
} finally {
  process.stdin.setRawMode(false);
  process.stdin.pause();
  process.stdout.write("\n");
}
const child = spawn(
  process.execPath,
  ["scripts/run.mjs", "tsx", "scripts/create-admin.ts"],
  { stdio: ["pipe", "inherit", "inherit"], windowsHide: true },
);
child.stdin.end(JSON.stringify({ email, name, password }));
password = "";
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
