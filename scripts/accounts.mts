/**
 * Account administration — runs on a trusted machine with SUPABASE_SECRET_KEY.
 *
 *   node scripts/accounts.mts bootstrap <household.json> [--dry-run]
 *       Creates or updates a household from a seed file (idempotent) and
 *       prints first-access codes for the accounts it creates.
 *   node scripts/accounts.mts issue-code <username>
 *       New activation code for first access or password reset.
 *
 * Never logs phone numbers, internal e-mails or keys. Activation codes are
 * printed once, for the operator to hand over in person / by message.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { formatActivationCode, generateActivationCode } from "../src/features/auth/activation-code.ts";
import { Constants, type Database } from "../src/types/database.ts";

type Admin = ReturnType<typeof createClient<Database>>;
type Enums = Database["public"]["Enums"];

const ACTIVATION_VALIDITY = "72 hours";
const Enum = Constants.public.Enums;

// -----------------------------------------------------------------------------
// Seed file schema (unknown keys such as "$comment", "source", "review" are
// documentation and are ignored).
// -----------------------------------------------------------------------------
const money = z.string().regex(/^\d+(\.\d{1,2})?$/, "use a decimal string like 1234.56");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const monthDate = isoDate.refine((value) => value.endsWith("-01"), "competence months are day 1");

const ruleSchema = z.object({
  kind: z.enum(Enum.transaction_kind),
  description: z.string().min(1).max(140),
  amount: money,
  category: z.string(),
  subcategory: z.string().optional(),
  member: z.string().optional(),
  paymentMethod: z.string().optional(),
  startsOn: isoDate,
  endsOn: isoDate.optional(),
  skip: z.boolean().optional(),
});

const plannedSchema = z.object({
  kind: z.enum(Enum.transaction_kind),
  description: z.string().min(1).max(140),
  amount: money,
  category: z.string(),
  subcategory: z.string().optional(),
  member: z.string().optional(),
  paymentMethod: z.string().optional(),
  competenceMonth: monthDate,
  skip: z.boolean().optional(),
});

const seedSchema = z.object({
  household: z.object({
    name: z.string().min(2).max(80),
    currencyCode: z.string().length(3).default("BRL"),
    locale: z.string().default("pt-BR"),
    timeZone: z.string().default("America/Recife"),
    emergencyReserveMonths: z.number().int().min(1).max(36).default(6),
  }),
  members: z
    .array(
      z.object({
        key: z.string(),
        username: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,31}$/),
        fullName: z.string().max(160).optional(),
        displayName: z.string().min(1).max(60),
        relationship: z.string().max(40).optional(),
        role: z.enum(Enum.household_role),
        phoneE164: z
          .string()
          .regex(/^\+[1-9]\d{7,14}$/)
          .optional(),
      }),
    )
    .min(1)
    .refine((members) => members.filter((m) => m.role === "owner").length === 1, "exactly one owner is required"),
  paymentMethods: z.array(z.object({ key: z.string(), name: z.string().max(60), type: z.enum(Enum.payment_method_type) })),
  subcategories: z.array(z.object({ parent: z.string(), name: z.string().max(60) })),
  recurringRules: z.array(ruleSchema),
  plannedTransactions: z.array(plannedSchema),
});

type Seed = z.infer<typeof seedSchema>;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function fail(message: string): never {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function loadEnv(): { url: string; secretKey: string; emailDomain: string } {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Variables may come from the shell instead.
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";
  if (!url) fail("NEXT_PUBLIC_SUPABASE_URL is missing (.env.local).");
  if (!secretKey.startsWith("sb_secret_")) {
    fail(
      "SUPABASE_SECRET_KEY must be the project's SECRET key (starts with sb_secret_). " +
        "Find it in Supabase > Project Settings > API Keys > Secret keys.",
    );
  }
  return { url, secretKey, emailDomain: process.env.AUTH_INTERNAL_EMAIL_DOMAIN || "accounts.invalid" };
}

function adminClient(url: string, secretKey: string): Admin {
  return createClient<Database>(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

type QueryResult<T> = { data: T; error: { message: string } | null };

/** For queries that must return data. */
function check<T>(result: QueryResult<T>, what: string): NonNullable<T> {
  if (result.error) fail(`${what}: ${result.error.message}`);
  if (result.data === null || result.data === undefined) fail(`${what}: no data returned`);
  return result.data;
}

/** For writes that return no rows (insert/update without select). */
function checkOk(result: { error: { message: string } | null }, what: string): void {
  if (result.error) fail(`${what}: ${result.error.message}`);
}

/** For lookups that may legitimately find nothing (maybeSingle). */
function checkMaybe<T>(result: QueryResult<T>, what: string): T {
  if (result.error) fail(`${what}: ${result.error.message}`);
  return result.data;
}

function readSeed(path: string): Seed {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`Could not read ${path}: ${(error as Error).message}`);
  }
  const parsed = seedSchema.safeParse(raw);
  if (!parsed.success) {
    fail(`Invalid seed file:\n${parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n")}`);
  }
  validateReferences(parsed.data);
  return parsed.data;
}

/** Offline checks: every key a rule points at must be declared in the file. */
function validateReferences(seed: Seed): void {
  const members = new Set(seed.members.map((m) => m.key));
  const methods = new Set(seed.paymentMethods.map((p) => p.key));
  const subcategories = new Set(seed.subcategories.map((s) => `${s.parent}>${s.name}`));
  const problems: string[] = [];
  for (const item of [...seed.recurringRules, ...seed.plannedTransactions]) {
    if (item.member && !members.has(item.member)) problems.push(`${item.description}: unknown member "${item.member}"`);
    if (item.paymentMethod && !methods.has(item.paymentMethod)) {
      problems.push(`${item.description}: unknown payment method "${item.paymentMethod}"`);
    }
    if (item.subcategory && !subcategories.has(`${item.category}>${item.subcategory}`)) {
      problems.push(`${item.description}: subcategory "${item.category} > ${item.subcategory}" is not declared`);
    }
  }
  if (problems.length > 0) fail(`Invalid references:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
}

async function issueCode(admin: Admin, profileId: string, issuedBy: string | null): Promise<{ code: string; expiresAt: string }> {
  const code = generateActivationCode();
  const expiresAt = check(
    await admin.rpc("auth_issue_activation", {
      p_profile_id: profileId,
      p_code: code,
      p_valid_for: ACTIVATION_VALIDITY,
      ...(issuedBy ? { p_issued_by: issuedBy } : {}),
    }),
    "issue activation code",
  );
  return { code: formatActivationCode(code), expiresAt };
}

function formatExpiry(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone }).format(new Date(value));
}

// -----------------------------------------------------------------------------
// bootstrap
// -----------------------------------------------------------------------------
async function bootstrap(path: string, dryRun: boolean): Promise<void> {
  const seed = readSeed(path);
  const activeRules = seed.recurringRules.filter((r) => !r.skip);
  const activePlanned = seed.plannedTransactions.filter((t) => !t.skip);
  console.log(
    `✓ ${path} is valid: ${seed.members.length} members, ${activeRules.length} recurring rules ` +
      `(${seed.recurringRules.length - activeRules.length} skipped), ${activePlanned.length} planned transactions.`,
  );
  if (dryRun) return;

  const env = loadEnv();
  const admin = adminClient(env.url, env.secretKey);
  const summary: string[] = [];
  const newCodes: { username: string; displayName: string; code: string; expiresAt: string }[] = [];

  // 1. Accounts ------------------------------------------------------------
  const profileIds = new Map<string, string>();
  const created = new Set<string>();
  for (const member of seed.members) {
    const existing = checkMaybe(
      await admin.from("profiles").select("id").eq("username", member.username).maybeSingle(),
      "find profile",
    );
    let profileId = existing?.id;
    if (!profileId) {
      const { data, error } = await admin.auth.admin.createUser({
        email: `${randomUUID()}@${env.emailDomain}`,
        email_confirm: true,
        // Unusable until the person sets their own password with an activation code.
        password: `${randomBytes(32).toString("base64url")}a1`,
        app_metadata: { username: member.username, display_name: member.displayName, full_name: member.fullName },
      });
      if (error || !data.user) fail(`create account "${member.username}": ${error?.message ?? "no user returned"}`);
      profileId = data.user.id;
      created.add(member.key);
      summary.push(`account created: ${member.username}`);
    }
    profileIds.set(member.key, profileId);
    if (member.phoneE164) {
      checkOk(
        await admin.from("profile_contacts").update({ phone_e164: member.phoneE164 }).eq("profile_id", profileId),
        "save phone",
      );
    }
  }

  const owner = seed.members.find((m) => m.role === "owner");
  if (!owner) fail("seed has no owner");
  const ownerId = profileIds.get(owner.key) as string;

  // 2. Household + members -------------------------------------------------
  let household = checkMaybe(
    await admin.from("households").select("id").eq("name", seed.household.name).eq("created_by", ownerId).maybeSingle(),
    "find household",
  );
  if (!household) {
    household = check(
      await admin
        .from("households")
        .insert({
          name: seed.household.name,
          currency_code: seed.household.currencyCode,
          locale: seed.household.locale,
          time_zone: seed.household.timeZone,
          emergency_reserve_months: seed.household.emergencyReserveMonths,
          created_by: ownerId,
        })
        .select("id")
        .single(),
      "create household",
    );
    summary.push(`household created: ${seed.household.name}`);
  }
  const householdId = household.id;

  // Owner first: the household must never exist without one.
  const orderedMembers = [...seed.members].sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner"));
  const memberIds = new Map<string, string>();
  for (const member of orderedMembers) {
    const profileId = profileIds.get(member.key) as string;
    const row = check(
      await admin
        .from("household_members")
        .upsert(
          { household_id: householdId, profile_id: profileId, role: member.role, relationship: member.relationship ?? null },
          { onConflict: "household_id,profile_id" },
        )
        .select("id")
        .single(),
      `save member ${member.username}`,
    );
    memberIds.set(member.key, row.id);
    checkOk(
      await admin.from("user_preferences").update({ default_household_id: householdId }).eq("profile_id", profileId),
      "save default household",
    );
  }

  // 3. Categories ----------------------------------------------------------
  type CategoryRow = { id: string; name: string; parent_id: string | null; kind: Enums["transaction_kind"]; icon: string | null; color: string | null };
  const loadCategories = async (): Promise<CategoryRow[]> =>
    check(
      await admin
        .from("categories")
        .select("id, name, parent_id, kind, icon, color")
        .eq("household_id", householdId)
        .is("archived_at", null),
      "load categories",
    );
  let categories = await loadCategories();
  const topLevel = (name: string) => categories.find((c) => c.parent_id === null && c.name === name);

  for (const sub of seed.subcategories) {
    const parent = topLevel(sub.parent);
    if (!parent) fail(`category "${sub.parent}" does not exist in the household`);
    if (categories.some((c) => c.parent_id === parent.id && c.name === sub.name)) continue;
    checkOk(
      await admin.from("categories").insert({
        household_id: householdId,
        parent_id: parent.id,
        kind: parent.kind,
        name: sub.name,
        icon: parent.icon,
        color: parent.color,
      }),
      `create subcategory ${sub.name}`,
    );
    summary.push(`subcategory created: ${sub.parent} > ${sub.name}`);
  }
  categories = await loadCategories();

  const categoryId = (category: string, subcategory?: string): string => {
    const parent = topLevel(category);
    if (!parent) fail(`category "${category}" not found`);
    if (!subcategory) return parent.id;
    const child = categories.find((c) => c.parent_id === parent.id && c.name === subcategory);
    if (!child) fail(`subcategory "${category} > ${subcategory}" not found`);
    return child.id;
  };

  // 4. Payment methods -----------------------------------------------------
  const existingMethods = check(
    await admin.from("payment_methods").select("id, name").eq("household_id", householdId),
    "load payment methods",
  );
  const methodIds = new Map<string, string>();
  for (const method of seed.paymentMethods) {
    let id = existingMethods.find((m) => m.name === method.name)?.id;
    if (!id) {
      id = check(
        await admin
          .from("payment_methods")
          .insert({ household_id: householdId, name: method.name, type: method.type })
          .select("id")
          .single(),
        `create payment method ${method.name}`,
      ).id;
      summary.push(`payment method created: ${method.name}`);
    }
    methodIds.set(method.key, id);
  }

  const references = (item: { category: string; subcategory?: string; member?: string; paymentMethod?: string }) => ({
    category_id: categoryId(item.category, item.subcategory),
    member_id: item.member ? (memberIds.get(item.member) ?? null) : null,
    payment_method_id: item.paymentMethod ? (methodIds.get(item.paymentMethod) ?? null) : null,
  });

  // 5. Recurring rules -----------------------------------------------------
  const existingRules = check(
    await admin.from("recurring_rules").select("kind, description, amount, starts_on").eq("household_id", householdId),
    "load recurring rules",
  );
  for (const rule of activeRules) {
    const duplicate = existingRules.some(
      (r) => r.kind === rule.kind && r.description === rule.description && Number(r.amount) === Number(rule.amount) && r.starts_on === rule.startsOn,
    );
    if (duplicate) continue;
    checkOk(
      await admin.from("recurring_rules").insert({
        household_id: householdId,
        kind: rule.kind,
        description: rule.description,
        amount: Number(rule.amount),
        frequency: "monthly",
        starts_on: rule.startsOn,
        ends_on: rule.endsOn ?? null,
        created_by: ownerId,
        ...references(rule),
      }),
      `create recurring rule ${rule.description}`,
    );
    summary.push(`recurring rule created: ${rule.description}`);
  }

  // 6. Planned one-off transactions ----------------------------------------
  const existingPlanned = check(
    await admin
      .from("transactions")
      .select("description, amount, competence_month")
      .eq("household_id", householdId)
      .is("recurring_rule_id", null)
      .is("deleted_at", null),
    "load transactions",
  );
  for (const item of activePlanned) {
    const duplicate = existingPlanned.some(
      (t) => t.description === item.description && Number(t.amount) === Number(item.amount) && t.competence_month === item.competenceMonth,
    );
    if (duplicate) continue;
    checkOk(
      await admin.from("transactions").insert({
        household_id: householdId,
        kind: item.kind,
        status: "pending",
        description: item.description,
        amount: Number(item.amount),
        occurred_on: item.competenceMonth,
        competence_month: item.competenceMonth,
        is_planned: true,
        created_by: ownerId,
        ...references(item),
      }),
      `create planned transaction ${item.description}`,
    );
    summary.push(`planned transaction created: ${item.description} (${item.competenceMonth.slice(0, 7)})`);
  }

  // 7. First-access codes for the accounts created now ---------------------
  for (const member of seed.members) {
    if (!created.has(member.key)) continue;
    const issuedBy = member.key === owner.key ? null : ownerId;
    const { code, expiresAt } = await issueCode(admin, profileIds.get(member.key) as string, issuedBy);
    newCodes.push({ username: member.username, displayName: member.displayName, code, expiresAt });
  }

  console.log(summary.length > 0 ? `\n${summary.map((line) => `  • ${line}`).join("\n")}` : "\n  Nothing to change: already up to date.");
  if (newCodes.length > 0) {
    console.log("\nFirst-access codes (shown only now — hand them over in person or by private message):");
    for (const entry of newCodes) {
      console.log(
        `  ${entry.username.padEnd(12)} ${entry.code}   ${entry.displayName} · valid until ${formatExpiry(entry.expiresAt, seed.household.timeZone)}`,
      );
    }
    console.log("\nAt the login screen: type the username, leave the password empty and tap Entrar.");
  }
}

// -----------------------------------------------------------------------------
// issue-code
// -----------------------------------------------------------------------------
async function issueCodeFor(username: string): Promise<void> {
  const env = loadEnv();
  const admin = adminClient(env.url, env.secretKey);
  const profile = checkMaybe(
    await admin.from("profiles").select("id, display_name, status").eq("username", username.trim().toLowerCase()).maybeSingle(),
    "find profile",
  );
  if (!profile) fail(`No account with username "${username}".`);
  if (profile.status === "disabled") fail(`Account "${username}" is disabled.`);
  const { code, expiresAt } = await issueCode(admin, profile.id, null);
  console.log(`\n  ${username} (${profile.display_name}): ${code}   valid until ${formatExpiry(expiresAt, "America/Recife")}`);
  console.log("  The person signs in with an empty password to use it. Any previous code stops working.");
}

// -----------------------------------------------------------------------------
const [command, argument, ...flags] = process.argv.slice(2);
if (command === "bootstrap" && argument) {
  await bootstrap(argument, flags.includes("--dry-run"));
} else if (command === "issue-code" && argument) {
  await issueCodeFor(argument);
} else {
  console.log("Usage:\n  node scripts/accounts.mts bootstrap <household.json> [--dry-run]\n  node scripts/accounts.mts issue-code <username>");
  process.exit(command ? 1 : 0);
}
