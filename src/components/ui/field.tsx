import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const inputClasses = cn(
  "h-12 w-full rounded-[var(--radius-control)] border border-border bg-surface px-4 text-base text-foreground",
  "placeholder:text-muted-foreground/70 transition-colors",
  "focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30",
  "aria-invalid:border-expense aria-invalid:ring-expense/20 disabled:opacity-60",
);

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClasses, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClasses, "appearance-auto pr-3", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClasses, "h-auto min-h-24 py-3", className)} {...props} />;
}

interface FieldProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (describedBy: string | undefined) => ReactNode;
}

/** Label + control + hint/error, wired with aria-describedby. */
export function Field({ id, label, hint, error, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children(describedBy)}
      {error ? (
        <p id={errorId} className="text-sm text-expense">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
