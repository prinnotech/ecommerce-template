import { cn } from "@repo/ui/lib/utils";

type DetailLayoutProps = {
  main: React.ReactNode;
  sidebar: React.ReactNode;
};

// Detail pages (order, product, customer): main cards on the left, context cards on the right.
// On phones the sidebar follows the main column.
export function DetailLayout({ main, sidebar }: DetailLayoutProps) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-4">{main}</div>
      <aside className="flex min-w-0 flex-col gap-4">{sidebar}</aside>
    </div>
  );
}

type SectionCardProps = {
  title?: React.ReactNode;
  // Top-right of the card: a status badge or an "Edit" link.
  action?: React.ReactNode;
  description?: React.ReactNode;
  // Content that runs to the card's edges (tables, item lists).
  is_flush?: boolean;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

// The card every detail and form page is made of.
export function SectionCard({ title, action, description, is_flush, footer, className, children }: SectionCardProps) {
  const has_header = Boolean(title || action);
  return (
    <section
      className={cn(
        "bg-card text-card-foreground ring-foreground/10 overflow-hidden rounded-xl text-sm ring-1",
        className,
      )}
    >
      {has_header && (
        <header className="flex items-start justify-between gap-3 px-4 pt-4">
          <div className="flex flex-col gap-1">
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && <p className="text-muted-foreground text-xs">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn(is_flush ? (has_header ? "pt-3" : "") : "p-4")}>{children}</div>
      {footer && <footer className="bg-muted/40 border-t px-4 py-3">{footer}</footer>}
    </section>
  );
}
