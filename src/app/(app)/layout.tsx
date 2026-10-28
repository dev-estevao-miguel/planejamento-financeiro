import { Suspense, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { BottomNav } from "@/components/shell/bottom-nav";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { QuickActions } from "@/components/shell/quick-actions";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { UserSummary, UserSummarySkeleton } from "@/components/shell/user-summary";
import { OfflineBanner } from "@/features/pwa/offline-banner";
import { RealtimeBridge } from "@/features/realtime/realtime-bridge";

/**
 * Authenticated app shell. Everything here is static and prerendered; the
 * parts that read the session (user summary, page content) stream in behind
 * <Suspense>, so the frame appears instantly.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r border-border bg-surface px-4 py-6 lg:flex">
        <Logo className="px-2" />
        <QuickActions variant="button" />
        <SidebarNav />
        <div className="mt-auto border-t border-border pt-4">
          <Suspense fallback={<UserSummarySkeleton />}>
            <UserSummary />
          </Suspense>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-lg lg:hidden">
          <div className="flex h-14 items-center">
            <Logo compact />
            <span className="ml-2.5 text-[15px] font-semibold tracking-tight">Finanças</span>
          </div>
        </header>
        <OfflineBanner />
        <main
          id="conteudo"
          className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:pt-10 lg:pb-12"
        >
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </main>
      </div>

      <BottomNav />
      <QuickActions variant="fab" />
      <Suspense fallback={null}>
        <RealtimeBridge />
      </Suspense>
    </div>
  );
}
