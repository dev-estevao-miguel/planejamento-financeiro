import "server-only";
import { z } from "zod";
import { parseEnv } from "./env";

const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  AUTH_INTERNAL_EMAIL_DOMAIN: z
    .string()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "must be a bare domain")
    .default("accounts.invalid"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedServerEnv: ServerEnv | undefined;

/** Server-only secrets. Importing this from a Client Component fails the build. */
export function getServerEnv(): ServerEnv {
  cachedServerEnv ??= parseEnv(serverEnvSchema, {
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    AUTH_INTERNAL_EMAIL_DOMAIN: process.env.AUTH_INTERNAL_EMAIL_DOMAIN || undefined,
  });
  return cachedServerEnv;
}
