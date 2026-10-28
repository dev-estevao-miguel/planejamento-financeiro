"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

interface HouseholdRealtimeProps {
  householdId: string;
  userId: string;
  /** profileId -> display name, to say who changed what. */
  names: Record<string, string>;
}

type ChangedRow = {
  created_by?: string | null;
  updated_by?: string | null;
  recurring_rule_id?: string | null;
};

const REFRESH_DELAY_MS = 600;

/**
 * Keeps the open screen in sync with the rest of the family: changes to
 * transactions and budgets (Supabase Realtime, same RLS as the API) refresh the
 * server-rendered data and say who made them. Own changes are already applied
 * by the Server Action that made them, so they are ignored here.
 */
export function HouseholdRealtime({ householdId, userId, names }: HouseholdRealtimeProps) {
  const router = useRouter();
  const namesRef = useRef(names);

  useEffect(() => {
    namesRef.current = names;
  }, [names]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pendingActors = new Set<string>();

    const schedule = (actor: string | null) => {
      if (actor) pendingActors.add(actor);
      clearTimeout(timer);
      timer = setTimeout(() => {
        router.refresh();
        const who = [...pendingActors].map((id) => namesRef.current[id] ?? "outro membro");
        pendingActors.clear();
        if (who.length > 0) toast.info(`Atualizado agora por ${who.join(" e ")}`);
      }, REFRESH_DELAY_MS);
    };

    const onChange = (eventType: string, row: ChangedRow) => {
      // Occurrences materialized by the recurrence generator are not anyone's edit.
      if (eventType === "INSERT" && row.recurring_rule_id) return schedule(null);
      const actor = (eventType === "INSERT" ? row.created_by : (row.updated_by ?? row.created_by)) ?? null;
      if (actor === userId) return;
      schedule(actor);
    };

    const filter = `household_id=eq.${householdId}`;
    const channel = supabase
      .channel(`household:${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter }, (payload) =>
        onChange(payload.eventType, (payload.eventType === "DELETE" ? payload.old : payload.new) as ChangedRow),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_items", filter }, (payload) =>
        onChange(payload.eventType, (payload.eventType === "DELETE" ? payload.old : payload.new) as ChangedRow),
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [householdId, userId, router]);

  return null;
}
