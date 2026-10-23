import "dotenv/config";
import {operationsOnly} from "../src/lib/features";
import { processDueEvents } from "../src/lib/automation";
import { db } from "../src/lib/db";
let running = true;
process.on("SIGINT", () => {
  running = false;
});
process.on("SIGTERM", () => {
  running = false;
});
async function main() {
  if(operationsOnly){console.log("Automation disabled in operations-only mode.");await db.$disconnect();return;}
  while (running) {
    try {
      await processDueEvents();
    } catch {
      console.error(JSON.stringify({ event: "worker.tick_failed" }));
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  await db.$disconnect();
}
void main();
