-- =============================================================================
-- Finance core: categories, payment methods, recurring rules, transactions,
-- monthly budgets, goals and investments.
--
-- Conventions
--   * Money is NUMERIC(14,2) and always positive; the sign comes from `kind`.
--   * Monthly competences are DATEs on day 1 (see private.month_start).
--   * Every cross-table reference is a composite FK (household_id, <id>), so a
--     row can never point at a category/member/etc. of another household,
--     regardless of what the client sends. RLS alone would not catch that.
--   * Totals, balances and percentages are NOT stored; they are derived.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- categories (one level of subcategories via parent_id)
-- -----------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  parent_id uuid,
  kind public.transaction_kind not null,
  name text not null
    constraint categories_name_length check (char_length(btrim(name)) between 1 and 60),
  -- lucide-react icon name, e.g. "shopping-cart"
  icon text constraint categories_icon_format check (icon ~ '^[a-z0-9-]{1,48}$'),
  color text constraint categories_color_format check (color ~ '^#[0-9A-Fa-f]{6}$'),
  -- Feeds the "essential vs non-essential" indicators. Editable per household.
  is_essential boolean not null default false,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_household_id_id_key unique (household_id, id),
  constraint categories_parent_fk foreign key (household_id, parent_id)
    references public.categories (household_id, id) on delete cascade,
  constraint categories_not_own_parent check (parent_id <> id)
);
alter table public.categories enable row level security;
revoke all on public.categories from anon, authenticated;

create unique index categories_unique_active_name
  on public.categories (
    household_id,
    coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    private.normalize_search(name)
  )
  where archived_at is null;

create or replace function private.validate_category()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent_parent uuid;
  v_parent_kind public.transaction_kind;
begin
  if new.parent_id is not null then
    select c.parent_id, c.kind into v_parent_parent, v_parent_kind
    from public.categories c
    where c.id = new.parent_id;

    if v_parent_parent is not null
       or exists (select 1 from public.categories c where c.parent_id = new.id) then
      raise exception using errcode = 'P0001', message = 'category_max_depth';
    end if;
    if v_parent_kind is distinct from new.kind then
      raise exception using errcode = 'P0001', message = 'category_kind_mismatch';
    end if;
  end if;
  return new;
end;
$$;

create trigger categories_validate
  before insert or update of parent_id, kind on public.categories
  for each row execute function private.validate_category();

-- Default categories for every new household (no code change needed for a new
-- family). Users can rename, archive, recolor and add their own afterwards.
create or replace function private.create_default_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categories (household_id, kind, name, icon, color, is_essential, sort_order)
  select new.id, d.kind::public.transaction_kind, d.name, d.icon, d.color, d.is_essential, d.sort_order
  from (
    values
      ('expense', 'Moradia', 'house', '#6366F1', true, 10),
      ('expense', 'Alimentação', 'utensils', '#F59E0B', true, 20),
      ('expense', 'Transporte', 'car', '#0EA5E9', true, 30),
      ('expense', 'Saúde', 'heart-pulse', '#EF4444', true, 40),
      ('expense', 'Educação', 'graduation-cap', '#8B5CF6', true, 50),
      ('expense', 'Lazer', 'party-popper', '#EC4899', false, 60),
      ('expense', 'Assinaturas', 'repeat', '#14B8A6', false, 70),
      ('expense', 'Cartão de crédito', 'credit-card', '#64748B', false, 80),
      ('expense', 'Empréstimos', 'landmark', '#B45309', false, 90),
      ('expense', 'Compras', 'shopping-bag', '#F97316', false, 100),
      ('expense', 'Viagens', 'plane', '#06B6D4', false, 110),
      ('expense', 'Presentes', 'gift', '#D946EF', false, 120),
      ('expense', 'Pets', 'paw-print', '#84CC16', false, 130),
      ('expense', 'Impostos', 'receipt', '#78716C', true, 140),
      ('expense', 'Outros', 'circle-ellipsis', '#94A3B8', false, 990),
      ('income', 'Salário', 'briefcase', '#10B981', false, 10),
      ('income', 'Renda extra', 'sparkles', '#22C55E', false, 20),
      ('income', 'Freelance', 'laptop', '#059669', false, 30),
      ('income', 'Bônus', 'award', '#16A34A', false, 40),
      ('income', '13º salário', 'calendar-check', '#15803D', false, 50),
      ('income', 'Férias', 'sun', '#4ADE80', false, 60),
      ('income', 'Rendimentos', 'percent', '#0D9488', false, 70),
      ('income', 'Outras receitas', 'circle-plus', '#34D399', false, 990),
      ('investment', 'Investimentos', 'trending-up', '#2563EB', false, 10),
      ('investment', 'Reserva de emergência', 'shield-check', '#0891B2', false, 20)
  ) as d(kind, name, icon, color, is_essential, sort_order);
  return new;
end;
$$;

create trigger households_default_categories
  after insert on public.households
  for each row execute function private.create_default_categories();

-- -----------------------------------------------------------------------------
-- payment_methods (cards, PIX, cash, meal voucher...)
-- -----------------------------------------------------------------------------
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null
    constraint payment_methods_name_length check (char_length(btrim(name)) between 1 and 60),
  type public.payment_method_type not null,
  owner_member_id uuid,
  closing_day smallint constraint payment_methods_closing_day check (closing_day between 1 and 31),
  due_day smallint constraint payment_methods_due_day check (due_day between 1 and 31),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_methods_household_id_id_key unique (household_id, id),
  constraint payment_methods_owner_fk foreign key (household_id, owner_member_id)
    references public.household_members (household_id, id) on delete set null (owner_member_id)
);
alter table public.payment_methods enable row level security;
revoke all on public.payment_methods from anon, authenticated;

-- -----------------------------------------------------------------------------
-- recurring_rules: salary, rent, internet, subscriptions...
-- Occurrences are materialized into `transactions` by an idempotent generator
-- (unique recurring_rule_id + occurrence_date), a few weeks ahead only.
-- -----------------------------------------------------------------------------
create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  kind public.transaction_kind not null,
  description text not null
    constraint recurring_rules_description_length check (char_length(btrim(description)) between 1 and 140),
  amount numeric(14, 2) not null constraint recurring_rules_amount_positive check (amount > 0),
  category_id uuid,
  member_id uuid,
  payment_method_id uuid,
  frequency public.recurrence_frequency not null default 'monthly',
  interval_count smallint not null default 1
    constraint recurring_rules_interval_range check (interval_count between 1 and 12),
  -- Days beyond the month length fall on the last day (31 -> 30/Apr, 28/Feb).
  day_of_month smallint constraint recurring_rules_day_of_month check (day_of_month between 1 and 31),
  starts_on date not null,
  ends_on date,
  default_status public.transaction_status not null default 'pending',
  notes text constraint recurring_rules_notes_length check (char_length(notes) <= 1000),
  generated_until date,
  paused_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_rules_household_id_id_key unique (household_id, id),
  constraint recurring_rules_period check (ends_on is null or ends_on >= starts_on),
  constraint recurring_rules_category_fk foreign key (household_id, category_id)
    references public.categories (household_id, id) on delete set null (category_id),
  constraint recurring_rules_member_fk foreign key (household_id, member_id)
    references public.household_members (household_id, id) on delete set null (member_id),
  constraint recurring_rules_payment_method_fk foreign key (household_id, payment_method_id)
    references public.payment_methods (household_id, id) on delete set null (payment_method_id)
);
alter table public.recurring_rules enable row level security;
revoke all on public.recurring_rules from anon, authenticated;

-- -----------------------------------------------------------------------------
-- transactions: every income, expense and investment contribution.
-- -----------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  kind public.transaction_kind not null,
  status public.transaction_status not null default 'paid',
  description text not null
    constraint transactions_description_length check (char_length(btrim(description)) between 1 and 140),
  amount numeric(14, 2) not null constraint transactions_amount_positive check (amount > 0),
  category_id uuid,
  -- "Responsável". NULL = the household as a whole.
  member_id uuid,
  payment_method_id uuid,
  occurred_on date not null,
  competence_month date not null
    constraint transactions_competence_month_day_one check (competence_month = private.month_start(competence_month)),
  due_on date,
  is_planned boolean not null default false,
  visibility public.record_visibility not null default 'household',
  notes text constraint transactions_notes_length check (char_length(notes) <= 1000),
  recurring_rule_id uuid,
  occurrence_date date,
  installment_group_id uuid,
  installment_number smallint,
  installment_total smallint,
  search_text text generated always as (private.normalize_search(description)) stored,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  deleted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint transactions_household_id_id_key unique (household_id, id),
  constraint transactions_occurrence_unique unique (recurring_rule_id, occurrence_date),
  constraint transactions_occurrence_date_required
    check (recurring_rule_id is null or occurrence_date is not null),
  constraint transactions_installments check (
    (installment_group_id is null and installment_number is null and installment_total is null)
    or (
      installment_group_id is not null
      and installment_total between 2 and 360
      and installment_number between 1 and installment_total
    )
  ),
  constraint transactions_category_fk foreign key (household_id, category_id)
    references public.categories (household_id, id) on delete set null (category_id),
  constraint transactions_member_fk foreign key (household_id, member_id)
    references public.household_members (household_id, id) on delete set null (member_id),
  constraint transactions_payment_method_fk foreign key (household_id, payment_method_id)
    references public.payment_methods (household_id, id) on delete set null (payment_method_id),
  constraint transactions_recurring_rule_fk foreign key (household_id, recurring_rule_id)
    references public.recurring_rules (household_id, id) on delete set null (recurring_rule_id)
);
alter table public.transactions enable row level security;
revoke all on public.transactions from anon, authenticated;

create index transactions_household_competence_idx
  on public.transactions (household_id, competence_month)
  where deleted_at is null;
create index transactions_household_occurred_idx
  on public.transactions (household_id, occurred_on desc, created_at desc)
  where deleted_at is null;
create index transactions_household_due_idx
  on public.transactions (household_id, due_on)
  where status = 'pending' and deleted_at is null;
create index transactions_installment_group_idx
  on public.transactions (installment_group_id)
  where installment_group_id is not null;
create index transactions_search_trgm_idx
  on public.transactions using gin (search_text extensions.gin_trgm_ops);

create or replace function private.prepare_transaction()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_category_kind public.transaction_kind;
begin
  if new.competence_month is null then
    new.competence_month := private.month_start(new.occurred_on);
  end if;

  if new.category_id is not null then
    -- Runs as the caller, so a category from another household is invisible.
    select c.kind into v_category_kind from public.categories c where c.id = new.category_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'category_not_found';
    end if;
    if v_category_kind <> new.kind then
      raise exception using errcode = 'P0001', message = 'category_kind_mismatch';
    end if;
  end if;
  return new;
end;
$$;

create trigger transactions_prepare
  before insert or update of kind, category_id, occurred_on, competence_month on public.transactions
  for each row execute function private.prepare_transaction();

-- -----------------------------------------------------------------------------
-- budgets: one per household per month; budget_items: planned amount per
-- category. Realized values are always computed from transactions.
-- -----------------------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  month date not null constraint budgets_month_day_one check (month = private.month_start(month)),
  notes text constraint budgets_notes_length check (char_length(notes) <= 1000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_household_id_id_key unique (household_id, id),
  constraint budgets_household_month_key unique (household_id, month)
);
alter table public.budgets enable row level security;
revoke all on public.budgets from anon, authenticated;

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  budget_id uuid not null,
  category_id uuid not null,
  planned_amount numeric(14, 2) not null
    constraint budget_items_planned_amount_non_negative check (planned_amount >= 0),
  alert_threshold_pct smallint not null default 90
    constraint budget_items_alert_threshold_range check (alert_threshold_pct between 1 and 100),
  notes text constraint budget_items_notes_length check (char_length(notes) <= 500),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_items_budget_category_key unique (budget_id, category_id),
  constraint budget_items_budget_fk foreign key (household_id, budget_id)
    references public.budgets (household_id, id) on delete cascade,
  constraint budget_items_category_fk foreign key (household_id, category_id)
    references public.categories (household_id, id) on delete cascade
);
alter table public.budget_items enable row level security;
revoke all on public.budget_items from anon, authenticated;

-- -----------------------------------------------------------------------------
-- financial_goals
-- -----------------------------------------------------------------------------
create table public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  kind public.goal_kind not null default 'general',
  name text not null
    constraint financial_goals_name_length check (char_length(btrim(name)) between 1 and 80),
  -- NULL only for the emergency reserve, whose target is derived from
  -- essential monthly cost x households.emergency_reserve_months.
  target_amount numeric(14, 2)
    constraint financial_goals_target_positive check (target_amount > 0),
  starting_amount numeric(14, 2) not null default 0
    constraint financial_goals_starting_non_negative check (starting_amount >= 0),
  target_date date,
  status public.goal_status not null default 'active',
  achieved_at timestamptz,
  icon text constraint financial_goals_icon_format check (icon ~ '^[a-z0-9-]{1,48}$'),
  color text constraint financial_goals_color_format check (color ~ '^#[0-9A-Fa-f]{6}$'),
  notes text constraint financial_goals_notes_length check (char_length(notes) <= 1000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_goals_household_id_id_key unique (household_id, id),
  constraint financial_goals_target_required check (kind = 'emergency_reserve' or target_amount is not null)
);
alter table public.financial_goals enable row level security;
revoke all on public.financial_goals from anon, authenticated;

create unique index financial_goals_one_emergency_reserve
  on public.financial_goals (household_id)
  where kind = 'emergency_reserve' and status <> 'archived';

-- "Responsáveis" by a goal.
create table public.goal_members (
  household_id uuid not null,
  goal_id uuid not null,
  member_id uuid not null,
  primary key (goal_id, member_id),
  constraint goal_members_goal_fk foreign key (household_id, goal_id)
    references public.financial_goals (household_id, id) on delete cascade,
  constraint goal_members_member_fk foreign key (household_id, member_id)
    references public.household_members (household_id, id) on delete cascade
);
alter table public.goal_members enable row level security;
revoke all on public.goal_members from anon, authenticated;

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  goal_id uuid not null,
  member_id uuid,
  -- Negative = money taken out of the goal.
  amount numeric(14, 2) not null constraint goal_contributions_amount_non_zero check (amount <> 0),
  contributed_on date not null,
  transaction_id uuid,
  notes text constraint goal_contributions_notes_length check (char_length(notes) <= 500),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  deleted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint goal_contributions_goal_fk foreign key (household_id, goal_id)
    references public.financial_goals (household_id, id) on delete cascade,
  constraint goal_contributions_member_fk foreign key (household_id, member_id)
    references public.household_members (household_id, id) on delete set null (member_id),
  constraint goal_contributions_transaction_fk foreign key (household_id, transaction_id)
    references public.transactions (household_id, id) on delete set null (transaction_id)
);
alter table public.goal_contributions enable row level security;
revoke all on public.goal_contributions from anon, authenticated;

create index goal_contributions_goal_idx on public.goal_contributions (goal_id) where deleted_at is null;

-- -----------------------------------------------------------------------------
-- investments + investment_entries (position history; no broker integration)
-- A contribution paid from the household budget also has a `transactions`
-- row (kind = 'investment') linked through investment_entries.transaction_id.
-- -----------------------------------------------------------------------------
create table public.investments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null
    constraint investments_name_length check (char_length(btrim(name)) between 1 and 80),
  type public.investment_type not null,
  institution text constraint investments_institution_length check (char_length(institution) <= 80),
  member_id uuid,
  goal_id uuid,
  objective text constraint investments_objective_length check (char_length(objective) <= 200),
  notes text constraint investments_notes_length check (char_length(notes) <= 1000),
  archived_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investments_household_id_id_key unique (household_id, id),
  constraint investments_member_fk foreign key (household_id, member_id)
    references public.household_members (household_id, id) on delete set null (member_id),
  constraint investments_goal_fk foreign key (household_id, goal_id)
    references public.financial_goals (household_id, id) on delete set null (goal_id)
);
alter table public.investments enable row level security;
revoke all on public.investments from anon, authenticated;

create table public.investment_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  investment_id uuid not null,
  kind public.investment_entry_kind not null,
  amount numeric(14, 2) not null,
  entry_date date not null,
  transaction_id uuid,
  notes text constraint investment_entries_notes_length check (char_length(notes) <= 500),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  deleted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint investment_entries_amount_check
    check (amount > 0 or (kind = 'balance_update' and amount = 0)),
  constraint investment_entries_investment_fk foreign key (household_id, investment_id)
    references public.investments (household_id, id) on delete cascade,
  constraint investment_entries_transaction_fk foreign key (household_id, transaction_id)
    references public.transactions (household_id, id) on delete set null (transaction_id)
);
alter table public.investment_entries enable row level security;
revoke all on public.investment_entries from anon, authenticated;

create index investment_entries_investment_idx
  on public.investment_entries (investment_id, entry_date)
  where deleted_at is null;

-- -----------------------------------------------------------------------------
-- updated_at / updated_by maintenance
-- -----------------------------------------------------------------------------
create trigger categories_touch before update on public.categories
  for each row execute function private.touch_row();
create trigger payment_methods_touch before update on public.payment_methods
  for each row execute function private.touch_row();
create trigger recurring_rules_touch before update on public.recurring_rules
  for each row execute function private.touch_row();
create trigger transactions_touch before update on public.transactions
  for each row execute function private.touch_row();
create trigger budgets_touch before update on public.budgets
  for each row execute function private.touch_row();
create trigger budget_items_touch before update on public.budget_items
  for each row execute function private.touch_row();
create trigger financial_goals_touch before update on public.financial_goals
  for each row execute function private.touch_row();
create trigger goal_contributions_touch before update on public.goal_contributions
  for each row execute function private.touch_row();
create trigger investments_touch before update on public.investments
  for each row execute function private.touch_row();
create trigger investment_entries_touch before update on public.investment_entries
  for each row execute function private.touch_row();
