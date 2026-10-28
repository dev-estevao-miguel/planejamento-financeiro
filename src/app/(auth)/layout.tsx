import { ChartPie, PiggyBank, Target } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { BRAND_GRADIENT } from "@/lib/brand";

const HIGHLIGHTS = [
  { icon: Target, text: "Planeje o mês por categoria" },
  { icon: ChartPie, text: "Acompanhe planejado × realizado" },
  { icon: PiggyBank, text: "Construam seus objetivos juntos" },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside
        className="relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between"
        style={{ backgroundImage: `linear-gradient(145deg, ${BRAND_GRADIENT.from}, ${BRAND_GRADIENT.to})` }}
      >
        <div className="absolute -right-24 -bottom-24 size-96 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <Logo onBrand />
        <div className="relative max-w-md">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight text-balance">
            Organize sua vida financeira em família.
          </h1>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-white/90">
                <span className="flex size-9 items-center justify-center rounded-xl bg-white/15">
                  <Icon className="size-5" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/70">Planeje. Acompanhe. Economize.</p>
      </aside>

      <main className="flex flex-col px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-10 sm:px-8 lg:justify-center lg:px-16">
        <Logo className="mb-10 lg:hidden" />
        <div className="mx-auto w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
