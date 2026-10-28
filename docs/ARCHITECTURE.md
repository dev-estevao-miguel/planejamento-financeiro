# Arquitetura

Plataforma de planejamento financeiro pessoal e familiar, **multi-tenant desde o primeiro dia**. A Família Demo é o tenant de exemplo. Cadastrar uma segunda família não exige nenhuma alteração de código.

## 1. Visão geral

```text
Browser / PWA (Next.js App Router, React 19)
   │  Server Components · Server Actions · Route Handlers  (Vercel, runtime Node.js)
   │        └── chave secreta Supabase só aqui (login por username, ativação, push)
   ▼
Supabase
   ├── Auth        sessões (cookies via @supabase/ssr)
   ├── Postgres    fonte oficial dos dados · RLS · triggers de auditoria
   ├── Realtime    atualizações ao vivo dentro do app
   └── pg_cron     recorrências, vencimentos, resumos (funções reais, sem "ping")
Web Push (VAPID)   notificações com o app fechado, disparadas pelo servidor
```

| Camada | Escolha | Motivo |
| --- | --- | --- |
| Framework | Next.js 16 (App Router, Cache Components) | Server Components reduzem JS no cliente; build nativo na Vercel. |
| Linguagem | TypeScript estrito | — |
| Estilo | Tailwind CSS 4 (+ componentes no estilo shadcn/ui na Fase 3) | Design system por tokens. |
| Validação | Zod 4 | Mesmos schemas validam formulários e Server Actions. |
| Banco/Auth | Supabase (Postgres 17) | RLS nativo, Realtime, Auth, pg_cron. |
| Testes | Vitest + PGlite | Os testes de banco rodam as **migrations reais** sem Docker. |

## 2. Estrutura de pastas

```text
src/
  app/                 rotas (App Router). Sem regra de negócio.
  components/          UI reutilizável (design system) — Fase 3
  features/<módulo>/   regra de negócio por domínio (finance, transactions, planning...)
    calculations.ts    fórmulas puras e testadas (única fonte de cálculos)
  lib/                 infraestrutura: env, supabase, money, dates
  types/database.ts    tipos gerados do banco (npm run db:types)
supabase/
  migrations/          SQL versionado (fonte da verdade do schema)
  seed/                formato de importação (exemplo fictício); private/ = dados reais, fora do git
  tests/               testes de banco (RLS, isolamento, integridade) via PGlite
docs/                  arquitetura, roadmap, análise da Fase 0
```

Regras: componentes não fazem query direta (usam funções de `features/*`); fórmulas financeiras só em `calculations.ts`; nada de `any`.

## 3. Multi-tenancy

O tenant técnico se chama **household** ("família" na interface). Ele foi escolhido no lugar de `workspace` porque descreve o domínio sem ambiguidade e continua válido para um usuário sozinho (uma família de 1 pessoa).

```text
auth.users ──1:1── profiles ──N:M── households  (via household_members: role, status)
                                      │
     categories · payment_methods · recurring_rules · transactions · budgets/budget_items
     financial_goals/goal_members/goal_contributions · investments/investment_entries
     notifications · notification_preferences · audit_logs · household_invites
```

- **Todo registro financeiro tem `household_id`.**
- **FKs compostas** `(household_id, x_id) → x(household_id, id)` em todas as referências internas. Mesmo o servidor com chave secreta (que ignora RLS) não consegue ligar uma transação da família A a uma categoria da família B.
- `household_members.profile_id` aceita nulo, para dependentes sem login no futuro.
- Um usuário pode pertencer a várias famílias. A família ativa fica em `user_preferences.default_household_id` e em um seletor na interface.
- **Categorias padrão** são criadas por trigger em cada nova família (`private.create_default_categories`), sem código específico de tenant.
- SaaS: `households.plan_code` reserva o lugar do plano (free/premium/family). Tabelas de billing (`plans`, `subscriptions`, limites) entram depois, sem mexer no núcleo.

## 4. Papéis e permissões

| Permissão | owner | admin | member | viewer |
| --- | :-: | :-: | :-: | :-: |
| finance.view | ✔ | ✔ | ✔ | ✔ |
| finance.create | ✔ | ✔ | ✔ | |
| finance.edit | ✔ | ✔ | ✔ | |
| finance.delete | ✔ | ✔ | | |
| planning.manage | ✔ | ✔ | | |
| members.manage | ✔ | ✔ | | |
| household.manage | ✔ | ✔ | | |

- Os padrões ficam em `role_permissions`. **Exceções por membro** ficam em `member_permissions` (`granted = true/false`). Assim é possível, por exemplo, dar `finance.delete` a um member ou retirar `finance.create` de alguém.
- O owner tem tudo implicitamente e não pode ser restringido. Ações exclusivas do owner (transferir propriedade, excluir a família) checam o papel diretamente nas RPCs.
- Uma constraint trigger **adiada** garante que toda família tenha ao menos um owner ativo. A transferência (promover + rebaixar) acontece numa única transação.
- Família Demo: Pessoa A = `owner`, Pessoa B = `admin`. Nada no código verifica nomes.

## 5. Autenticação (Fase 2)

### Login por username

O Supabase Auth autentica por e-mail ou telefone. A camada de username funciona assim:

1. Cada conta é criada **pelo servidor** (admin API) com:
   - um e-mail técnico aleatório: `<uuid>@AUTH_INTERNAL_EMAIL_DOMAIN`;
   - `username`, `display_name` e `full_name` em **app_metadata**, que o usuário não consegue editar.

   Um trigger cria o `profile` a partir desses dados. O cadastro público fica desligado.
2. A tela pede **Usuário** e **Senha**. Uma Server Action então:
   - valida a entrada com Zod e aplica rate limit;
   - busca o profile pelo username e o e-mail técnico com o cliente admin (só no servidor);
   - chama `signInWithPassword` pelo cliente SSR, que grava os cookies de sessão.
3. O e-mail técnico **nunca** sai do servidor, não aparece na interface e não entra em logs. Renomear o username não mexe no Auth.

### Primeiro acesso (sem "senha vazia" de verdade)

- Na tela de login, **senha em branco** leva ao fluxo "Primeiro acesso". Esse fluxo pede username e **código de ativação**, e a resposta não revela se a conta existe.
- O código de ativação:
  - é de uso único, com 8 caracteres de um alfabeto sem ambiguidade;
  - é guardado só como hash, expira em 72 h e aceita no máximo 5 tentativas;
  - é gerado pelo script de bootstrap (o do owner aparece uma única vez no terminal) ou pelo owner/admin na tela de membros, e entregue pessoalmente ou por WhatsApp.
- Com o código validado: "Crie sua senha" → confirmação → a senha é gravada pelo servidor → a conta passa a `active` → a sessão é aberta.
- **OTP por SMS** fica como `IdentityVerifier` plugável (Supabase Phone/Twilio Verify) quando houver orçamento. **Só conhecer o username nunca basta.**

### Demais regras

- **Senha:** mínimo de 8 caracteres, com letras e números (configurado em `supabase/config.toml` e no Dashboard).
- **Proteção contra brute force:** contador por `hash(username)` e por IP em tabela privada, com bloqueio progressivo. Isso se soma ao rate limit do próprio Supabase Auth.
- **Mensagens de erro:** genéricas, como "Usuário ou senha inválidos".
- **Sessão:** cookies `@supabase/ssr`, renovados no `proxy.ts`. Logout local ou global (sair de todos os dispositivos).
- **Esqueci minha senha:** usa o mesmo verificador (código gerado por owner/admin, SMS ou futuramente e-mail de recuperação verificado em `profile_contacts`).

## 6. Segurança no banco (RLS)

Uma escrita do cliente só passa se **todas** as camadas concordarem:

1. **Grants por coluna** (`authenticated`). O cliente não pode:
   - gravar `created_by`, que vem do default `auth.uid()`;
   - gravar `deleted_at`;
   - gravar `generated_until`;
   - alterar o `household_id` de um registro existente;
   - alterar o próprio papel.

   `anon` não tem acesso a nada.
2. **Políticas RLS**, todas no formato `household_id in (select private.households_with_permission('<perm>'))`. As funções auxiliares são `SECURITY DEFINER` e respondem apenas para `auth.uid()`. O `select` faz o Postgres avaliar a função uma vez por consulta, e não uma vez por linha.
3. **FKs compostas** (seção 3) e **triggers de validação**, como tipo de categoria × tipo de transação e no máximo um nível de subcategoria.

Detalhes:

- **Exclusão:** transações nunca são apagadas fisicamente pelo cliente. As RPCs `soft_delete_transaction` e `restore_transaction` exigem `finance.delete` e respondem `not_found_or_forbidden` tanto para "não existe" quanto para "sem permissão", o que impede sondar IDs. Elas são `SECURITY DEFINER` de propósito, porque o cliente não tem grant em `deleted_at`. Por isso o advisor 0029 do Supabase aparece para elas, e esse aviso é **aceito**. O mesmo vale para `ensure_recurring_transactions`: ela exige `finance.view` e só materializa as regras da própria família.
- **Privacidade entre membros:** `visibility = 'private'` faz a transação ser lida e editada só por quem a criou. A coluna já existe; a interface vem depois.
- **Dados sensíveis:** o telefone fica em `profile_contacts` (só o dono lê; alterações passam por verificação no servidor). As chaves de push não são legíveis pelo cliente.
- **Schema `private`:** fica fora da Data API, e `anon` não tem `USAGE` nele. `authenticated` só executa os helpers que a RLS, as CHECKs e as colunas geradas avaliam.
- **Regra para funções novas:** o Postgres concede `EXECUTE` a PUBLIC em toda função nova, e `ALTER DEFAULT PRIVILEGES … IN SCHEMA` **não** remove isso. Toda migration que cria uma função precisa revogar explicitamente (`revoke execute on function … from public, anon`) e conceder só o necessário. O teste "function privileges" falha se alguém esquecer.
- **Erros do banco:** usam códigos estáveis (`household_owner_required`, `category_kind_mismatch`...), que a interface traduz para mensagens amigáveis. A interface nunca mostra `PostgrestError`, SQL ou UUID.
- **Testes:** `supabase/tests/rls.test.ts` cobre:
  - isolamento entre famílias;
  - acesso de `anon`;
  - falsificação de `created_by`;
  - mover registro para outra família;
  - papéis e exceções por membro;
  - exclusão segura;
  - auditoria;
  - transações privadas;
  - busca.

## 7. Dinheiro, datas e cálculos

- **Banco:** `NUMERIC(14,2)`, sempre positivo; o sinal vem de `kind` (`income` | `expense` | `investment`).
- **TypeScript:** centavos inteiros (`src/lib/money.ts`). O valor vai ao Postgres como string decimal exata, e o parse de digitação pt-BR funciona assim: `3150` → R$ 3.150,00; `85,9` → R$ 85,90.
- **Datas:** strings ISO (`2026-10-23`), nunca `new Date("2026-10-23")`, que em Recife seria exibido como 22/10. "Hoje" é calculado no fuso da família (`households.time_zone`, padrão `America/Recife`).
- **Competência:** `DATE` no dia 1 (`competence_month`), derivada de `occurred_on` quando omitida.
- **Valores derivados nunca são armazenados.** Todas as fórmulas ficam em `src/features/finance/calculations.ts`:
  - **saldo disponível** = receitas − despesas − investimentos;
  - **economia** = receitas − despesas (investir também é poupar);
  - **taxa de poupança** = economia / receitas;
  - **renda comprometida** = despesas / receitas;
  - **uso do orçamento** = gasto / planejado. Os status são `on_track`, `warning` (≥ 90%, configurável por item) e `exceeded`, sempre exibidos com texto e ícone, não só com cor;
  - **reserva de emergência** = custo essencial médio × `households.emergency_reserve_months`. O custo essencial vem das categorias com `is_essential = true`.
- Um percentual sem base (renda zero) vira `null` e aparece como "—", nunca como 0% ou ∞.
- Se um dia forem necessárias agregações materializadas por performance, elas serão documentadas aqui.

## 8. Recorrências e parcelamentos

- **`recurring_rules`** define o padrão: valor, categoria, responsável, dia do mês (31 vira o último dia), início, fim e pausa.
- **Gerador idempotente** (`private.generate_recurring_transactions`, migration `20261024120000`): materializa as ocorrências em `transactions` como `is_planned = true` e status `default_status` (padrão `pending`) até o **fim do mês seguinte**, no fuso da família, e avança `generated_until`. A constraint `unique (recurring_rule_id, occurrence_date)` impede duplicar. Uma ocorrência excluída (soft delete) **não volta**.
- **Quem chama o gerador:** o pg_cron às 03:05 UTC (00:05 de Recife), quando a extensão existe, e a RPC `ensure_recurring_transactions(household_id)`, chamada pelas telas antes de ler os dados. Assim o app não depende do cron ter rodado.
- **Pausa:** retomar uma regra pausada não gera os meses em que ela ficou pausada.
- **Editar uma regra** não altera ocorrências já geradas; elas são editadas uma a uma.
- `generated_until` fica fora da auditoria, porque muda todo dia.
- **Parcelamento** (quantidade finita): cria as N transações num único INSERT, ligadas por `installment_group_id`, `installment_number` e `installment_total`. O valor digitado é o **total**; os centavos que sobram da divisão vão para as primeiras parcelas, então a soma sempre fecha. Só a primeira parcela recebe a situação escolhida; as demais nascem pendentes.

## 9. Auditoria

- `audit_logs` é preenchida por um trigger genérico (`private.audit_row_change`) em todas as entidades financeiras e em membros.
- **Ações:** `transaction.created`, `transaction.updated` (com `{campo: {from, to}}`), `transaction.deleted`/`restored`, `budget_item.updated`, `member.role_changed`...
- **Append-only:** nenhuma política de escrita para clientes.
- `entity_id` não tem FK, então o histórico sobrevive à exclusão do registro. Os logs só somem junto com a família inteira (exclusão LGPD).
- Ficam de fora colunas de controle (`updated_at`, `search_text`). Tabelas de credenciais nunca são auditadas, e senhas não passam pelo banco da aplicação.

## 10. Tempo real e notificações

| | Realtime (app aberto) | Web Push (app fechado) |
| --- | --- | --- |
| Mecanismo | Supabase Realtime `postgres_changes` (respeita RLS) | Service Worker + Push API + VAPID |
| Uso | Atualiza só as consultas afetadas, com aviso "Atualizado agora por Maria" | "Maria adicionou uma despesa de R$ 120,00 em Alimentação" |
| Origem | Mudanças em `transactions`, `budget_items` e `notifications` | Linha em `notifications` → webhook → Route Handler na Vercel (`web-push`) |

- **Notificações** são criadas por triggers, com uma linha por destinatário e respeitando `notification_preferences`. O banco guarda `type` + `data`, e o texto é montado na interface (pronto para i18n). `data` nunca leva telefone, e-mail ou segredos.
- **Push:** a assinatura pertence ao **dispositivo** (`push_subscriptions.endpoint` é único), e um usuário pode ter várias. Respostas 404/410 do provedor revogam a assinatura. A permissão do navegador só é pedida depois de um toque explícito em "Ativar notificações".
- **iOS:** o push exige o PWA instalado (iOS 16.4+).
- **Implementação:** `features/realtime` assina `transactions` e `budget_items` da família ativa. Mudanças de outros membros fazem `router.refresh()` (com 600 ms de espera para agrupar) e mostram "Atualizado agora por …". As próprias mudanças já são atualizadas pela Server Action, e as ocorrências criadas pelo gerador não geram aviso.
- **Escala SaaS:** trocar `postgres_changes` por Broadcast a partir do banco (`realtime.broadcast_changes`) com canais por família.

## 11. PWA e offline (Fase 3)

- **Manifesto e Service Worker:** `app/manifest.ts` com ícones, `display: standalone` e `theme_color`. O Service Worker é enxuto em `public/sw.js`.
- **Cache:** assets estáticos com cache-first; navegação com network-first e página offline de fallback. Quando há um novo SW, aparece o aviso "Nova versão disponível".
- **Offline:**
  - o último dashboard carregado continua visível com a faixa **"Você está offline · dados de 23/10 14:32"**;
  - **escritas offline ficam bloqueadas no MVP**, porque uma fila só será criada quando puder garantir idempotência. O `id` gerado no cliente, já permitido pelo schema, prepara esse caminho.

## 12. Tarefas agendadas

Usam pg_cron, só para funções reais do produto:

- gerar recorrências às 00:05;
- verificar vencimentos às 07:00;
- notificações financeiras às 08:00;
- resumo mensal no último dia do mês.

**Não há "ping" artificial.** Antes de ativar os cron jobs, conferir as regras vigentes de inatividade do plano Supabase. A arquitetura não depende do plano gratuito.

## 13. Exportação para IA

- `features/ai-export` monta um **prompt** a partir de uma seleção explícita do usuário: nomes, salários individuais, despesas individuais, investimentos, metas e observações. O texto é sempre mostrado na íntegra antes de copiar ou baixar o `.txt`.
- **Nunca inclui:** telefone, e-mail técnico, IDs, tokens ou segredos. O builder trabalha com uma lista de campos permitidos, não com campos bloqueados.
- **IA integrada no futuro:** uma interface `AiProvider` (OpenAI, Anthropic...) entra atrás de uma feature flag. O app funciona sem nenhuma IA.

## 14. Privacidade e LGPD

Dados financeiros e pessoais são tratados como sensíveis. A estrutura prevista inclui:

- política de privacidade;
- exportação dos dados da família (JSON/CSV);
- exclusão de conta. A família precisa manter um owner, então o owner transfere a propriedade ou exclui a família;
- consentimento de notificações (assinatura por dispositivo, revogável);
- trilha de auditoria.

Na prática:

- testes só com pessoas fictícias;
- dados reais de bootstrap fora do git;
- planilha original fora do git;
- logs técnicos sem dados pessoais.

## 15. Decisões arquiteturais (ADR resumido)

| # | Decisão | Alternativa descartada |
| --- | --- | --- |
| 1 | `household` como tenant | `workspace` (menos claro para o domínio) |
| 2 | Uma tabela `transactions` para receitas, despesas e aportes | Tabelas `incomes`/`expenses` separadas (duplicariam filtros, busca, RLS e relatórios) |
| 3 | Subcategoria = `categories.parent_id` (1 nível) | Tabela `subcategories` (duplicaria RLS/CRUD) |
| 4 | FKs compostas com `household_id` | Confiar só na RLS |
| 5 | Grants por coluna + RPCs para soft delete | Políticas de UPDATE amplas |
| 6 | Username → e-mail técnico resolvido no servidor | Tabela própria de senhas (reimplementar auth) |
| 7 | Código de ativação no primeiro acesso, SMS plugável | Senha vazia; SMS obrigatório (custo) |
| 8 | Notificação guarda `type` + `data`; texto na UI | Texto pronto no banco (sem i18n) |
| 9 | Investimentos = `investments` + `investment_entries` (+ transação `investment` quando o dinheiro sai do orçamento) | Aportes só como despesa (sem posição/evolução) |
| 10 | PGlite para testar migrations e RLS | Testar só no projeto remoto |
| 11 | Dinheiro em centavos inteiros no TS | `number` em reais (erros como 1302.5500000000002) |
