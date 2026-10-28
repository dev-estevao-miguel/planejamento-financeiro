import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/** Client IP as reported by the platform proxy (Vercel sets x-real-ip). */
export async function getClientIp(): Promise<string> {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-real-ip") ??
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** Throttle keys are hashed so raw usernames/IPs are never stored. */
export function throttleKey(kind: "user" | "ip", value: string): string {
  return createHash("sha256").update(`${kind}:${value}`).digest("hex");
}

export async function throttleKeysFor(username: string): Promise<{ user: string; ip: string; all: string[] }> {
  const user = throttleKey("user", username);
  const ip = throttleKey("ip", await getClientIp());
  return { user, ip, all: [user, ip] };
}

/** Server log without personal data: only the step and a provider error code. */
export function logAuthFailure(step: string, error: unknown): void {
  const code =
    typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "unknown";
  console.error(`[auth] ${step} failed (code=${code})`);
}
