import type { Metadata } from "next";
import { Bell, Bot, ChevronRight, Info, LogOut, Shield, Smartphone, Tags, UserRound, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { UserSummary } from "@/components/shell/user-summary";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Card } from "@/components/ui/card";
import { logoutAction } from "@/features/auth/actions";
import { InstallCard } from "@/features/pwa/install-card";

export const metadata: Metadata = { title: "Mais" };

const UPCOMING: { icon: LucideIcon; label: string }[] = [
  { icon: UserRound, label: "Minha conta" },
  { icon: Users, label: "Família e membros" },
  { icon: Tags, label: "Categorias" },
  { icon: Bell, label: "Notificações" },
  { icon: Shield, label: "Segurança" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  );
}

export default function MorePage() {
  return (
    <>
      <PageHeader title="Mais" description="Conta, família e preferências do aplicativo." />
      <div className="flex flex-col gap-8">
        <Card className="p-4">
          <UserSummary />
        </Card>

        <Section title="Ferramentas">
          <Card>
            <Link href="/relatorios/exportar-ia" className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium hover:bg-surface-muted">
              <Bot className="size-5 text-primary" aria-hidden />
              <span className="flex-1">Exportar para IA</span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </Card>
        </Section>

        <Section title="Configurações">
          <Card className="divide-y divide-border">
            {UPCOMING.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3.5 text-sm text-muted-foreground">
                <Icon className="size-5" aria-hidden />
                <span className="flex-1">{label}</span>
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px]">Em breve</span>
              </div>
            ))}
          </Card>
        </Section>

        <Section title="Aparência">
          <ThemeSwitcher />
        </Section>

        <Section title="Aplicativo">
          <Card className="flex flex-col gap-3 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Smartphone className="size-5 text-primary" aria-hidden /> Instalar no dispositivo
            </p>
            <InstallCard />
          </Card>
        </Section>

        <Section title="Sessão">
          <Card className="divide-y divide-border">
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium text-expense hover:bg-expense-soft"
              >
                <LogOut className="size-5" aria-hidden /> Sair
              </button>
            </form>
            <form action={logoutAction}>
              <input type="hidden" name="scope" value="global" />
              <button
                type="submit"
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm text-muted-foreground hover:bg-surface-muted"
              >
                <Shield className="size-5" aria-hidden /> Sair de todos os dispositivos
              </button>
            </form>
          </Card>
        </Section>

        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Info className="size-3.5" aria-hidden /> Planejamento Financeiro · versão 0.1 (MVP em desenvolvimento)
        </p>
      </div>
    </>
  );
}
