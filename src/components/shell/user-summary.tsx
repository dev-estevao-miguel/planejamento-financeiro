import { LogOut } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { logoutAction } from "@/features/auth/actions";
import { getAppContext } from "@/features/auth/session";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : ""}`.toUpperCase();
}

/** Who is signed in and in which household. Reads the session: render inside <Suspense>. */
export async function UserSummary() {
  const { user, household } = await getAppContext();
  return (
    <div className="flex items-center gap-3">
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary"
        aria-hidden
      >
        {initials(user.displayName)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.displayName}</p>
        <p className="truncate text-xs text-muted-foreground">{household?.name ?? "Sem família"}</p>
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          aria-label="Sair"
          title="Sair"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}

export function UserSummarySkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="size-10 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}
