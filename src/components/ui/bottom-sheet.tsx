"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Bottom sheet on phones, centered dialog from `sm` up. Built on the native
 * <dialog>: focus trapping, Esc to close and an inert background come from
 * the browser instead of a dependency.
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="bottom-sheet-title"
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-0 mt-auto w-full max-w-none animate-sheet-up rounded-t-[1.75rem] border border-border bg-surface p-0 text-foreground shadow-[var(--shadow-float)] sm:m-auto sm:max-w-md sm:animate-fade-in sm:rounded-[var(--radius-card)]"
    >
      <div className="px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border sm:hidden" aria-hidden />
        <div className="mb-3 flex items-center justify-between">
          <h2 id="bottom-sheet-title" className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-muted"
            aria-label="Fechar"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
