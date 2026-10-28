# Planejamento Financeiro

Plataforma web (PWA) de planejamento financeiro pessoal e familiar: planejado × realizado, recorrências, metas e relatórios, com isolamento total entre famílias.

<p>
  <a href="https://financeiro.tscbr.com.br"><img alt="Acessar Planejamento Financeiro" src="https://img.shields.io/badge/VER%20PROJETO-financeiro.tscbr.com.br-2ea44f?style=for-the-badge&logo=googlechrome&logoColor=white"/></a>
</p>

<p>
  <img alt="Status" src="https://img.shields.io/badge/status-em%20desenvolvimento-10bfe1?style=flat-square"/>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-1f2334?style=flat-square&logo=nextdotjs&logoColor=white"/>
  <img alt="React" src="https://img.shields.io/badge/React-19-1f2334?style=flat-square&logo=react&logoColor=61DAFB"/>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-1f2334?style=flat-square&logo=typescript&logoColor=3178C6"/>
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres%2017-1f2334?style=flat-square&logo=supabase&logoColor=3ECF8E"/>
  <img alt="Dados" src="https://img.shields.io/badge/dados-100%25%20fict%C3%ADcios-10bfe1?style=flat-square"/>
</p>

> **Versão pública com dados de demonstração.** Nenhum dado financeiro ou pessoal real está neste repositório. Nomes, valores e cartões citados na documentação são fictícios (Família Demo, Pessoa A, Pessoa B).

## O problema

O orçamento de muitas famílias vive em uma planilha: uma aba com a projeção de 12 meses, outra com as faturas dos cartões, outra com "premissas" escritas à mão. Funciona até a primeira divergência. A renda aparece em três lugares com três valores, uma parcela termina em meses diferentes conforme a aba, e um total é só a cópia de outro total.

A planilha também não separa o que foi **planejado** do que foi **realizado**, não sabe quem lançou o quê nem quando, e duas pessoas editando o mesmo arquivo acabam sobrescrevendo o trabalho uma da outra. Parcelamentos são redigitados mês a mês, sem regra de término.

Este projeto transforma essa planilha em um sistema: cada família é um *tenant* isolado por Row Level Security, as recorrências geram os lançamentos sozinhas e os totais são sempre derivados, nunca digitados.

## O que faz

- **Movimentações:** criar, editar, duplicar, excluir (soft delete), parcelar, repetir, buscar e filtrar.
- **Planejado × realizado** por mês e por categoria, com orçamento e alerta de estouro.
- **Recorrências** (salários, contas fixas, parcelas) geradas automaticamente com `pg_cron`, de forma idempotente.
- **Dashboard e relatórios** por categoria, por membro e por período.
- **Tempo real:** o que um membro lança aparece para o outro na hora.
- **Exportação para IA:** gera um resumo do período pronto para análise em um assistente.
- **Login por usuário** com código de primeiro acesso (sem SMS pago), bloqueio por tentativas e auditoria.
- **PWA instalável**, mobile first, com página offline.

## Capturas

As capturas de tela serão adicionadas com a base de demonstração. A interface nunca é publicada com dados reais.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Zod 4 · Supabase (Postgres 17, Auth, Realtime, pg_cron) · Vitest + PGlite · Vercel.

## Como executar

### Estrutura

```text
src/app/                 rotas
src/features/            regras de negócio por domínio:
                           auth, transactions, planning, finance (cálculos e agregações),
                           reports, ai-export, realtime, pwa
src/lib/                 env, clientes Supabase, dinheiro, datas
supabase/migrations/     schema versionado (fonte da verdade)
supabase/tests/          testes de RLS e isolamento entre famílias
supabase/seed/           formato de importação (exemplo fictício); private/ fica fora do git
docs/                    arquitetura e roadmap
```

### Pré-requisitos

- Node.js ≥ 20.11 (desenvolvido com 24.x) e npm.
- Um projeto Supabase. O Supabase CLI já vem como dependência de desenvolvimento (`npx supabase`).
- Docker **não** é necessário: os testes de banco usam PGlite.

### Instalação

```bash
npm install
cp .env.example .env.local   # e preencha
```

#### Variáveis de ambiente

| Variável | Onde é usada | Pública? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser e servidor | sim |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser e servidor (chave `sb_publishable_…`) | sim |
| `SUPABASE_SECRET_KEY` | **somente servidor** (chave `sb_secret_…`, ignora RLS) | **não** |
| `AUTH_INTERNAL_EMAIL_DOMAIN` | servidor: domínio dos e-mails técnicos de login por username | não |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push (Fase 9) | só a pública |
| `NEXT_PUBLIC_APP_URL` | URLs absolutas | sim |

`.env.local` nunca é versionado. A chave secreta jamais deve aparecer em código client-side. `src/lib/env.server.ts` usa `server-only` para quebrar o build se isso acontecer.

### Configurar o Supabase

Todo o schema vem das migrations. Nada é criado manualmente pelo Dashboard.

```bash
npx supabase login                 # abre o navegador
npm run db:link                    # = supabase link (escolha o seu projeto; pede a senha do banco)
npm run db:push                    # aplica supabase/migrations no projeto remoto
npm run db:types                   # gera src/types/database.ts a partir do schema
```

Ajustes no Dashboard (Authentication), que espelham `supabase/config.toml`:

1. **Desligar novos cadastros** (*Allow new users to sign up* = off). As contas são criadas pelo servidor.
2. **Senha:** mínimo de 8 caracteres, com letras e números.
3. **Project Settings → Data API → Exposed schemas:** manter apenas `public` (e `graphql_public`). O schema `private` **não** deve ser exposto.

Para aplicar a configuração de Auth via CLI em vez do Dashboard, use `npx supabase config push`.

#### Seed / importação inicial

- `supabase/seed.sql` está vazio de propósito: contas precisam ser criadas pelo Supabase Auth.
- O formato de importação de uma família está em [`supabase/seed/household.example.json`](supabase/seed/household.example.json), com dados fictícios.
- Os dados reais de uma família ficam em `supabase/seed/private/`, pasta **ignorada pelo git**. Este repositório não contém nenhum.

#### Criar a família e as contas (bootstrap)

O script roda na sua máquina, com a chave secreta (`SUPABASE_SECRET_KEY=sb_secret_…` no `.env.local`). Ele é idempotente: rodar de novo não duplica nada.

```bash
# só valida o arquivo, sem acessar o banco
npm run accounts:bootstrap -- supabase/seed/private/familia-demo.json --dry-run

# cria contas, família, membros, subcategorias, formas de pagamento, recorrências e lançamentos planejados
npm run accounts:bootstrap -- supabase/seed/private/familia-demo.json
```

No final, o script mostra **uma única vez** o código de primeiro acesso (válido por 72 h) de cada conta criada. Entregue o código pessoalmente ou por mensagem privada.

#### Primeiro acesso e "esqueci minha senha"

1. Na tela de login, digite o usuário (ex.: `pessoa.a`), deixe a senha **em branco** e toque em **Entrar**.
2. Informe o código de acesso e crie a senha (mínimo de 8 caracteres, com letras e números).
3. Para redefinir a senha de alguém, gere um novo código. O código anterior deixa de valer:

```bash
npm run accounts:issue-code -- pessoa.b
```

O código expira em 72 h e é invalidado depois de 5 tentativas erradas. O login bloqueia temporariamente depois de 5 falhas (por usuário e por IP). Só o hash do código fica no banco.

### Executar localmente

```bash
npm run dev        # http://localhost:3000
```

### Testes e qualidade

```bash
npm run test       # todos os testes (unidade + banco)
npm run test:db    # só RLS/isolamento: roda as migrations reais em Postgres (PGlite)
npm run lint
npm run typecheck
npm run build
npm run check      # tudo acima, em sequência
```

Os testes de banco cobrem:

- isolamento entre famílias e acesso anônimo;
- papéis e exceções de permissão;
- tentativa de falsificar `created_by` ou mover um registro para outra família;
- soft delete e auditoria;
- transações privadas, integridade e busca sem acento;
- gerador de recorrências: datas (dia 31, semanas, anos), idempotência, pausa e permissões.

Os testes usam apenas pessoas fictícias.

### Build e deploy (Vercel)

O endereço público oficial da demonstração é **https://financeiro.tscbr.com.br**.

```bash
npm run build
```

Na Vercel (Fase 12): importar o repositório, cadastrar as variáveis da tabela acima em *Production* e *Preview* (`SUPABASE_SECRET_KEY` só como variável sensível de servidor) e adicionar a URL de produção em *Authentication → URL Configuration* no Supabase.

### PWA e notificações

**PWA:**

- Manifesto em `src/app/manifest.ts`.
- Ícones gerados em `/icons/192`, `/icons/512` e `/icons/maskable`, além de `/icon` e `/apple-icon`.
- Service Worker em `public/sw.js`, registrado **só em produção**. Ele aplica cache apenas nos assets versionados e mostra a página `/offline`; nenhum dado financeiro fica em cache.
- Quando sai uma versão nova, aparece o aviso "Nova versão disponível · Atualizar".

Para testar localmente:

```bash
npm run build && npx next start   # http://localhost:3000 (o Service Worker exige HTTPS ou localhost)
```

No celular, a instalação e as notificações exigem HTTPS. Use o endereço publicado na Vercel ou `npx next dev --experimental-https`.

**Notificações:** chegam na Fase 9, com Web Push e VAPID. Para gerar as chaves VAPID:

```bash
npx web-push generate-vapid-keys
```

Detalhes em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#10-tempo-real-e-notificações).

## Escopo da versão pública

- Código completo da aplicação, migrations, testes e documentação técnica.
- A análise da planilha de origem ([docs/PHASE0_ANALYSIS.md](docs/PHASE0_ANALYSIS.md)) foi reescrita com **valores e nomes fictícios**, preservando o método.
- Não acompanham o repositório: a planilha original, arquivos `.env*` e a pasta `supabase/seed/private/` (todos no `.gitignore`).

## Licença

Código-fonte disponível para consulta e estudo. **Todos os direitos reservados**; veja [LICENSE](LICENSE).

---

Desenvolvido por **Estevão dos Santos** · [github.com/dev-estevao-miguel](https://github.com/dev-estevao-miguel)
