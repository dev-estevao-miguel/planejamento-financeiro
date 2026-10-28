"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/cn";
import { NAV_ITEMS, isActive } from "./nav-items";

function SidebarNavView({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Principal">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname !== null && isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-medium transition-colors",
                  active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function ActiveSidebarNav() {
  return <SidebarNavView pathname={usePathname()} />;
}

/**
 * The pathname is request data on dynamic routes (/movimentacoes/[id]), so the
 * active state streams in; the fallback is the same nav without highlight.
 */
export function SidebarNav() {
  return (
    <Suspense fallback={<SidebarNavView pathname={null} />}>
      <ActiveSidebarNav />
    </Suspense>
  );
}
