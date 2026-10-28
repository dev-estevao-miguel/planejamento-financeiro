import { z } from "zod";

/**
 * Public configuration, safe to ship to the browser.
 * NEXT_PUBLIC_* values must be referenced literally so Next.js can inline them.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

let cachedPublicEnv: PublicEnv | undefined;

export function getPublicEnv(): PublicEnv {
  cachedPublicEnv ??= parseEnv(publicEnvSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || undefined,
  });
  return cachedPublicEnv;
}

/** Validates env vars, reporting only the names of invalid keys (never their values). */
export function parseEnv<T extends z.ZodType>(schema: T, values: Record<string, unknown>): z.infer<T> {
  const result = schema.safeParse(values);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Invalid or missing environment variables: ${keys.join(", ")}. See .env.example.`);
  }
  return result.data;
}
