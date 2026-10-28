import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

type FieldShellProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
};

// Shopify-style field: the label sits inside the box and floats up once there's a value.
// The label is a real <label>, so screen readers announce it normally.
function FieldShell({ id, error, hint, children }: Omit<FieldShellProps, "label">) {
  return (
    <div className="flex flex-col gap-1">
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

const box =
  "peer border-input bg-background h-12 w-full rounded-md border px-3 pt-4 text-sm outline-none transition-colors focus:border-ring focus:ring-ring/40 focus:ring-2 aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:opacity-60";
const floating_label =
  "text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm transition-all peer-focus:top-3.5 peer-focus:text-xs peer-[:not(:placeholder-shown)]:top-3.5 peer-[:not(:placeholder-shown)]:text-xs";

function describedBy(id: string, error?: string, hint?: string): string | undefined {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

type FloatingInputProps = Omit<ComponentProps<"input">, "id" | "placeholder"> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  trailing?: ReactNode;
};

export function FloatingInput({ id, label, error, hint, trailing, className, ...props }: FloatingInputProps) {
  return (
    <FieldShell id={id} error={error} hint={hint}>
      <div className="relative">
        {/* placeholder=" " lets CSS know when the field is empty (:placeholder-shown). */}
        <input
          id={id}
          placeholder=" "
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn(box, trailing && "pr-10", className)}
          {...props}
        />
        <label htmlFor={id} className={floating_label}>
          {label}
        </label>
        {trailing && (
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
            {trailing}
          </span>
        )}
      </div>
    </FieldShell>
  );
}

type FloatingSelectProps = Omit<ComponentProps<"select">, "id"> & {
  id: string;
  label: string;
  error?: string;
};

export function FloatingSelect({ id, label, error, className, children, ...props }: FloatingSelectProps) {
  return (
    <FieldShell id={id} error={error}>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error)}
          className={cn(box, "appearance-none pr-9", className)}
          {...props}
        >
          {children}
        </select>
        <label htmlFor={id} className="text-muted-foreground pointer-events-none absolute top-1.5 left-3 text-xs">
          {label}
        </label>
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
        >
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
    </FieldShell>
  );
}
