# Fase 0 — Análise da planilha de origem (versão DEMO)

> **Documento de demonstração.** Todos os nomes, valores, cartões e datas abaixo são **fictícios**. Ele mostra o método usado para transformar uma planilha doméstica em um modelo de dados, sem expor nenhuma informação real.

## 1. Ponto de partida

| Item | Situação |
| --- | --- |
| Código-fonte | Nenhum. Havia apenas uma planilha `.xlsx` (não versionada). |
| Supabase | Projeto novo, gerenciado pelo Supabase CLI. |
| Autenticação | Inexistente. |
| Ferramentas locais | Node 24, npm 11, Git. **Sem Docker**: o Supabase local (`supabase start`) não roda na máquina de desenvolvimento. |

**Reaproveitável:** apenas a planilha, usada como fonte de conceito.

## 2. A planilha (exemplo fictício)

### 2.1 Abas

| Aba | Conteúdo | Fórmulas |
| --- | --- | --- |
| **Visão 12 meses** | Projeção mensal: despesas "Fixos", "Cartões", totais, renda e resultado. Bloco "RENDA" por pessoa. | `SUMIF` por grupo, soma, `renda − despesas`. |
| **Orçamento variável** | Categorias variáveis (Supermercado, Transporte, Farmácia, Lazer, Casa, Outros) ainda sem valores. | `SUM`. |
| **Controle dos cartões** | Parcelas/faturas por cartão, por mês. | Nenhuma (valores digitados). |
| **Premissas** | Textos que explicam os números. | — |

### 2.2 Dados de exemplo

#### Receitas (Família Demo)

| Fonte | Valor |
| --- | --- |
| Salário — Pessoa A | R$ 3.100 |
| Salário — Pessoa B | R$ 2.050 |
| Renda extra (benefício repassado) | R$ 600 |

**Despesas fixas (mensais):** Aluguel R$ 1.200 · Energia R$ 180 · Condomínio R$ 220 · Internet R$ 99,90 · Curso on-line R$ 149 · Plano de saúde R$ 310 · Celulares R$ 85.

#### Cartões / parcelamentos

| Cartão | Mês 1 | Mês 2 | Mês 3 → | Fim |
| --- | --- | --- | --- | --- |
| Cartão Alfa | 640,00 | 520,00 | 410,00 | Mês 9 |
| Cartão Beta | 300,00 | 300,00 | 300,00 | Mês 6 |
| Cartão Gama | 180,00 | 90,00 | — | Mês 2 |

**Não existia na planilha:** valores realizados (só projeção), vencimentos, forma de pagamento das fixas, responsável pelas contas, investimentos, metas e reserva de emergência.

### 2.3 Tipos de inconsistência encontrados

| # | Inconsistência | Tratamento adotado |
| --- | --- | --- |
| I-01 | A renda aparece em mais de um lugar, com valores diferentes. | Uma única fonte confirmada pelo usuário. |
| I-02 | "Renda familiar" digitada à mão, sem referência ao bloco de renda. | No sistema, a renda é **derivada** das receitas. |
| I-03 | O mesmo cartão tem valores diferentes em duas abas. | Uma representação importada; divergência registrada. |
| I-04 | Datas de término de parcelamento divergentes entre abas. | Prevalece a fonte majoritária; item marcado para revisão. |
| I-05 | Mês encerrado sem renda lançada, gerando resultado negativo artificial. | Mês não importado como transação. |
| I-06 | Possível item contado duas vezes dentro de uma fatura. | Mantido na fatura e marcado para conferência. |
| I-07 | Orçamento variável vazio e sem a fórmula de saldo prometida. | Só as subcategorias são criadas; o planejamento vai para o onboarding. |
| I-08 | Meses como **texto** em dois formatos ("Set/2026" e "Set/26"). | Competência vira `DATE` no dia 1. |
| I-09 | Imprecisão de ponto flutuante (`1302.5500000000002`). | `NUMERIC(14,2)` no banco e centavos inteiros no TypeScript. |
| I-10 | "Fixos" e "Cartões" usados como categorias, misturando periodicidade e forma de pagamento. | Natureza → `categories`; cartão → `payment_methods`; periodicidade → `recurring_rules`. |
| I-11 | Linha de total que só repete outra linha. | Descartada; totais são derivados. |

### 2.4 Limitações estruturais que o sistema resolve

- Não separa **planejado** de **realizado**.
- Não registra **quem** lançou o quê, nem **quando**: sem histórico ou auditoria.
- Parcelas digitadas mês a mês, sem regra de recorrência nem término.
- Sem visão individual × familiar, metas, investimentos ou reserva de emergência.
- Duas pessoas editando o mesmo arquivo, sem tempo real nem permissões.

## 3. Planilha → novo sistema

| Planilha | Novo sistema | Observação |
| --- | --- | --- |
| Família implícita | `households` + `household_members` + `profiles` | A Família Demo é o tenant de exemplo. |
| Renda por pessoa | `recurring_rules` (kind `income`, categoria Salário, `member_id`) → `transactions` | |
| Renda extra | `recurring_rules` (kind `income`, categoria **Renda extra**) | |
| Renda familiar | **Derivada** (soma das receitas) | Nunca armazenada. |
| Despesas "Fixos" | `recurring_rules` (kind `expense`) com categoria/subcategoria | Itens com prazo usam `ends_on`. |
| Despesas "Cartões" | `payment_methods` (`credit_card`) + `recurring_rules` com início/fim | |
| Orçamento variável | `budgets` (mês) + `budget_items` (categoria, planejado) | |
| Totais e saldo | Cálculo derivado (`summarizePeriod`, `budgetUsage`) | `src/features/finance/calculations.ts`. |
| Premissas | `notes` dos registros + este documento | |
| — (não existia) | `audit_logs`, `notifications`, `push_subscriptions`, `financial_goals`, `investments` | Novos módulos. |

## 4. Estratégia de importação

1. **Normalização:** os dados reais de uma família ficam em `supabase/seed/private/<familia>.json`, pasta **ignorada pelo git**. O formato está em `supabase/seed/household.example.json` (fictício):
   - valores como strings decimais (`"582.72"`);
   - datas ISO, competências no dia 1;
   - telefones em E.164;
   - usuários referenciados por chave (`pessoa_a`, `pessoa_b`), nunca por UUID;
   - cada item com `source` (célula de origem) e, quando necessário, `review` ou `skip`.
2. **Duplicidades:** quando duas abas repetem os mesmos cartões, importa-se **uma** representação e registra-se a divergência.
3. **Bootstrap:** um script servidor (chave secreta, nunca no navegador) lê o JSON, valida com Zod e cria, em ordem: contas no Supabase Auth (`pending_activation`, sem senha utilizável), a família e os membros, subcategorias, formas de pagamento, regras recorrentes e transações planejadas. O script é idempotente.
4. **Depois da migração, o Supabase é a fonte oficial.** A planilha vira arquivo histórico.
5. **Testes** usam somente pessoas fictícias (`supabase/tests/support/fixtures.ts`).

## 5. Riscos técnicos

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Sem Docker: não há Supabase local. | Migrations validadas só no remoto. | **PGlite** (Postgres 17 em WASM) roda as migrations reais + um shim do Supabase em `npm run test:db`. |
| Login por username no Supabase Auth (orientado a e-mail/telefone). | Identidade. | E-mail técnico interno por conta (`<uuid>@AUTH_INTERNAL_EMAIL_DOMAIN`), resolvido só no servidor e nunca exibido. O domínio `.invalid` é aceito. |
| OTP por SMS exige provedor pago. | Primeiro acesso. | Código de ativação de uso único (hash, expira, tentativas limitadas), entregue fora do app pelo owner. |
| Plano gratuito do Supabase pausa projetos inativos. | Disponibilidade. | Sem "ping" artificial; os cron jobs executam funções reais. |
| Push no iOS só com o PWA instalado (iOS 16.4+). | Notificações. | Orientar a instalação na tela de ativação. |
| `postgres_changes` com RLS escala mal em SaaS. | Custo futuro. | Serve no MVP; migração para Broadcast documentada. |
| Repositório público expondo dados. | LGPD. | `.xlsx`, `.env*` e `supabase/seed/private/` no `.gitignore`; documentação só com dados fictícios. |

## 6. Validação no projeto remoto

| Verificação | Resultado |
| --- | --- |
| Migrations locais × remotas | Todas aplicadas, sem divergência. |
| Tabelas em `public` com RLS | 100%. |
| Privilégios de `anon` em tabelas/colunas | 0. |
| Funções executáveis por `anon` | Nenhuma, após `20261023190000_harden_function_privileges`. |
| Teste de fumaça no banco (transação desfeita) | Perfis criados pelo trigger; categorias padrão; usuário vê só a própria família; auditoria gravada; escrita em outra família bloqueada pela RLS. |

**Problema encontrado e corrigido.** `ALTER DEFAULT PRIVILEGES … IN SCHEMA private REVOKE EXECUTE … FROM PUBLIC` não remove o `EXECUTE` que o Postgres concede a PUBLIC. A correção revoga o privilégio objeto a objeto e é coberta por testes. A mesma migration revoga o acesso à função `public.rls_auto_enable()`, que aparecia como RPC pública.

**Correção no bootstrap.** O `admin.createUser` do Supabase Auth aplica o `app_metadata` num UPDATE posterior, na mesma transação. A migration `20261023210000_profile_on_app_metadata` cria o perfil quando o username chega, com teste que reproduz essa ordem. O `user_metadata`, editável pelo próprio usuário, continua ignorado.
