"use client";
import { createAuthClient } from "better-auth/react";
import { passkeyClient } from "@better-auth/passkey/client";
export const authClient = createAuthClient({plugins:[passkeyClient()]});
export class ApiError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const result = await fetch(`/api/v1/${path}`, {
    method,
    headers:
      data !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: data !== undefined ? JSON.stringify(data) : undefined,
    cache: "no-store",
    credentials: "same-origin",
  });
  const json = await result.json();
  if (!result.ok) {const code=json.error??'INTERNAL_ERROR';window.dispatchEvent(new CustomEvent('opsvision-error',{detail:code}));throw new ApiError(code);}
  return json as T;
}
