"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getServerEnv } from "@/lib/env.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AUTH_MESSAGES, type AuthField, type AuthFormState } from "./messages";
import { safeRedirectPath } from "./safe-redirect";
import { activationCheckSchema, activationCompleteSchema, loginSchema } from "./schemas";
import { logAuthFailure, throttleKeysFor } from "./server/request-context";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function failure(message: string, extra: Partial<AuthFormState> = {}): AuthFormState {
  return { status: "error", message, ...extra };
}

async function isLocked(admin: AdminClient, keys: string[]): Promise<boolean> {
  const { data, error } = await admin.rpc("auth_throttle_locked_until", { p_keys: keys });
  if (error) throw error;
  return data !== null;
}

async function registerFailure(admin: AdminClient, keys: string[]): Promise<void> {
  const { error } = await admin.rpc("auth_throttle_register_failure", { p_keys: keys });
  if (error) throw error;
}

/** Resolves the internal Auth e-mail of an account. Never leaves the server. */
async function internalEmailOf(admin: AdminClient, profileId: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(profileId);
  if (error) throw error;
  return data.user?.email ?? null;
}

// -----------------------------------------------------------------------------
// Login: username + password
// -----------------------------------------------------------------------------
export async function loginAction(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const typedUsername = field(formData, "username");
  const parsed = loginSchema.safeParse({ username: typedUsername, password: field(formData, "password") });
  if (!parsed.success) return failure(AUTH_MESSAGES.invalidCredentials, { username: typedUsername });

  const { username, password } = parsed.data;
  // Empty password = "first access" experience, without revealing whether the account exists.
  if (password === "") redirect(`/primeiro-acesso?usuario=${encodeURIComponent(username)}`);

  try {
    const admin = createSupabaseAdminClient();
    const keys = await throttleKeysFor(username);
    if (await isLocked(admin, keys.all)) return failure(AUTH_MESSAGES.tooManyAttempts, { username });

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, status")
      .eq("username", username)
      .maybeSingle();
    if (profileError) throw profileError;

    // Unknown or inactive accounts still go through a sign-in attempt with a
    // throwaway address, so response time does not reveal which usernames exist.
    const email =
      (profile?.status === "active" ? await internalEmailOf(admin, profile.id) : null) ??
      `${randomUUID()}@${getServerEnv().AUTH_INTERNAL_EMAIL_DOMAIN}`;

    const supabase = await createSupabaseServerClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      await registerFailure(admin, keys.all);
      return failure(AUTH_MESSAGES.invalidCredentials, { username });
    }

    await admin.rpc("auth_throttle_clear", { p_keys: [keys.user] });
  } catch (error) {
    logAuthFailure("login", error);
    return failure(AUTH_MESSAGES.unavailable, { username });
  }

  redirect(safeRedirectPath(field(formData, "next")));
}

// -----------------------------------------------------------------------------
// First access / reset: username + activation code -> new password
// -----------------------------------------------------------------------------
async function verifyActivation(
  admin: AdminClient,
  username: string,
  code: string,
): Promise<{ profileId: string } | { error: string }> {
  const keys = await throttleKeysFor(username);
  if (await isLocked(admin, keys.all)) return { error: AUTH_MESSAGES.tooManyAttempts };

  const { data: profileId, error } = await admin.rpc("auth_check_activation", { p_username: username, p_code: code });
  if (error) throw error;
  if (!profileId) {
    await registerFailure(admin, keys.all);
    return { error: AUTH_MESSAGES.invalidActivation };
  }
  return { profileId };
}

/** Single entry point for the two-step form: check the code, then set the password. */
export async function activationAction(previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return formData.get("intent") === "complete"
    ? completeActivation(previous, formData)
    : checkActivation(previous, formData);
}

async function checkActivation(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const typed = { username: field(formData, "username"), code: field(formData, "code") };
  const parsed = activationCheckSchema.safeParse(typed);
  if (!parsed.success) return failure(AUTH_MESSAGES.invalidActivation, typed);

  try {
    const result = await verifyActivation(createSupabaseAdminClient(), parsed.data.username, parsed.data.code);
    if ("error" in result) return failure(result.error, typed);
    return { status: "code_verified", username: parsed.data.username, code: parsed.data.code };
  } catch (error) {
    logAuthFailure("activation check", error);
    return failure(AUTH_MESSAGES.unavailable, typed);
  }
}

async function completeActivation(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const typed = { username: field(formData, "username"), code: field(formData, "code") };
  const parsed = activationCompleteSchema.safeParse({
    ...typed,
    password: field(formData, "password"),
    confirmPassword: field(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    const fieldErrors: Partial<Record<AuthField, string>> = {};
    for (const issue of parsed.error.issues) {
      const name = issue.path[0];
      if (name === "password" || name === "confirmPassword") fieldErrors[name] ??= issue.message;
    }
    if (Object.keys(fieldErrors).length > 0) return { status: "code_verified", fieldErrors, ...typed };
    return failure(AUTH_MESSAGES.invalidActivation, typed);
  }

  const { username, code, password } = parsed.data;
  try {
    const admin = createSupabaseAdminClient();
    const result = await verifyActivation(admin, username, code);
    if ("error" in result) return failure(result.error, typed);

    const { error: updateError } = await admin.auth.admin.updateUserById(result.profileId, { password });
    if (updateError) {
      if (updateError.code === "weak_password") {
        return { status: "code_verified", fieldErrors: { password: AUTH_MESSAGES.weakPassword }, ...typed };
      }
      throw updateError;
    }

    const { error: completeError } = await admin.rpc("auth_complete_activation", { p_profile_id: result.profileId });
    if (completeError) throw completeError;

    const email = await internalEmailOf(admin, result.profileId);
    if (!email) throw new Error("account without internal e-mail");
    const supabase = await createSupabaseServerClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;

    const keys = await throttleKeysFor(username);
    await admin.rpc("auth_throttle_clear", { p_keys: [keys.user] });
  } catch (error) {
    logAuthFailure("activation complete", error);
    return failure(AUTH_MESSAGES.unavailable, typed);
  }

  redirect("/?bem-vindo=1");
}

// -----------------------------------------------------------------------------
// Logout
// -----------------------------------------------------------------------------
export async function logoutAction(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  // "global" ends the session on every device ("sair de todos os dispositivos").
  const scope = formData.get("scope") === "global" ? "global" : "local";
  const { error } = await supabase.auth.signOut({ scope });
  if (error) logAuthFailure("logout", error);
  redirect("/entrar");
}
