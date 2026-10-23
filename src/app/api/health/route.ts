import { db } from "@/lib/db";
import { response } from "@/lib/http";
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return response({
      status: "ok",
      database: "connected",
      camera: "not_integrated",
      email: "not_integrated",
    });
  } catch {
    return response({ status: "unavailable" }, 503);
  }
}
