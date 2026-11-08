import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  body?: string;
  // A button or link, e.g. "Add product".
  action?: React.ReactNode;
};

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  const Icon = icon;
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      {Icon && (
        <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
          <Icon className="size-6" aria-hidden />
        </span>
      )}
      <div className="flex max-w-sm flex-col gap-1">
        <p className="font-medium">{title}</p>
        {body && <p className="text-muted-foreground text-sm">{body}</p>}
      </div>
      {action}
    </div>
  );
}
