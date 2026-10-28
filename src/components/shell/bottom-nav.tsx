"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/cn";
import { NAV_ITEMS, isActive } from "./nav-items";

/** Phone navigation, thumb-reachable, respecting the home-indicator safe area. */
function BottomNavView({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname !== null && isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-primary-soft",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="max-w-full truncate px-0.5">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function ActiveBottomNav() {
  return <BottomNavView pathname={usePathname()} />;
}

/**
 * The pathname is request data on dynamic routes (/movimentacoes/[id]), so the
 * active state streams in; the fallback is the same nav without highlight.
 */
export function BottomNav() {
  return (
    <Suspense fallback={<BottomNavView pathname={null} />}>
      <ActiveBottomNav />
    </Suspense>
  );
}
