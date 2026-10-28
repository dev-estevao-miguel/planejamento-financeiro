# Roadmap

Legenda: ✅ concluído · 🟡 em andamento · ⬜ pendente

## MVP

| Fase | Entrega | Status |
| --- | --- | --- |
| 0 | Análise do repositório e da planilha ([PHASE0_ANALYSIS.md](PHASE0_ANALYSIS.md)) | ✅ |
| 1 | Arquitetura + banco: migrations, multi-tenancy, RLS, auditoria, testes de isolamento (PGlite) | ✅ Aplicado e validado no projeto remoto (advisors + teste de fumaça) |
| 2 | Supabase Auth: login por username, primeiro acesso com código de ativação, logout, rate limit, `proxy.ts`; bootstrap da Família Demo a partir do JSON normalizado; tipos gerados | ✅ Família Demo criada no Supabase (bootstrap idempotente) e login validado contra o projeto real. Falta só o primeiro acesso de cada membro |
| 3 | Design system (tokens, dark/light), shell responsivo (bottom nav mobile / sidebar desktop), loaders e skeletons, PWA (manifest, SW, ícones, offline, update) | ✅ Testado em navegador. O shell autenticado será validado após o primeiro login |
| 4 | Dashboard: saudação, saldo, renda individual/familiar, gastos, economia, planejado × realizado, alertas, filtro Todos/pessoa | 🟡 Implementado (24/10/2026); falta validar com dados reais após o primeiro acesso |
| 5 | Movimentações: criação rápida (bottom sheet), editar, duplicar, excluir (soft), parcelar, recorrência, busca, filtros, paginação; categorias e formas de pagamento | 🟡 Tudo implementado, menos a gestão de categorias e formas de pagamento (a tela em “Mais” segue “Em breve”) |
| 6 | Planejamento mensal: orçamento por categoria, % da renda, quanto ainda pode gastar, alertas | 🟡 Implementado, inclusive “copiar do mês anterior”; alerta configurável por item ainda sem tela |
| 7 | Relatórios e gráficos: por categoria, receita × despesa, evolução, por pessoa, períodos | 🟡 Implementado (períodos predefinidos; sem período personalizado) |
| 8 | Realtime ("Atualizado agora por …"), histórico/auditoria na UI, metas, investimentos, reserva de emergência | 🟡 Realtime implementado (publicação na migration `20261024120000`); histórico, metas, investimentos e reserva pendentes |
| 9 | Notificações: central (sino), preferências, Web Push (VAPID), multi-dispositivo; cron de recorrências e vencimentos | 🟡 Só o cron de recorrências (pg_cron 03:05 UTC); o resto pendente |
| 10 | Exportação para IA: seleção de dados, pré-visualização, copiar / baixar .txt | ✅ `/relatorios/exportar-ia` |
| 11 | Testes de fluxo, revisão de segurança, performance, acessibilidade | ⬜ |
| 12 | Vercel: projeto, variáveis, headers de segurança, domínio, deploy | ⬜ |

Migration `20261024120000_recurrence_realtime.sql` aplicada no projeto remoto em 24/10/2026: cron `generate-recurring-transactions` ativo (03:05 UTC) e `transactions`, `budget_items` e `notifications` publicadas no Realtime.

**Critério de saída do MVP:** os 20 itens do critério de sucesso do briefing, incluindo instalar o app, entrar como `marido` e como `esposa`, ver a despesa de um aparecer para o outro em tempo real, comparar planejado × gasto e gerar o prompt para IA.

## V1

- Onboarding guiado (conferir dados, renda, categorias, planejamento, notificações).
- Esqueci minha senha com verificador plugável. OTP por SMS, se houver orçamento.
- Gestão de membros: convidar, remover, alterar papel e permissões, transferir propriedade.
- Insights matemáticos ("Moradia representa 28% da renda", "gastos 12% maiores que no mês passado").
- Saúde financeira: % essenciais × não essenciais, capacidade de poupança.
- Exportação CSV/Excel/PDF.
- Transações privadas na interface.
- Exportação de dados e exclusão de conta (LGPD).

## V2

- Anexos e comprovantes (Supabase Storage, por família, com RLS).
- Tags, transferências internas entre contas, faturas de cartão com fechamento e vencimento.
- Modo offline com fila de sincronização idempotente.
- IA integrada (`AiProvider`), opcional e com consentimento explícito.
- Landing page pública.

## SaaS

- Cadastro self-service de famílias (`create_household`) e convites por link.
- Planos (free, premium, family), `subscriptions`, `features` e limites de uso, com billing.
- Realtime via Broadcast por família, observabilidade, backups e plano pago do Supabase.
- Internacionalização (catálogos de texto), outras moedas e fusos.
- Política de privacidade, termos, DPO e relatório de incidentes.
