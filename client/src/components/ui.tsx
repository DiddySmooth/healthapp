import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "chip";
}) {
  const styles = {
    primary:
      "h-11 rounded-[10px] px-4 bg-accent text-bg hover:brightness-105 disabled:opacity-50",
    ghost:
      "h-11 rounded-[10px] px-4 border border-border-strong bg-transparent text-fg hover:bg-raised disabled:opacity-50",
    danger:
      "h-11 rounded-[10px] px-4 border border-danger/25 bg-danger/15 text-danger hover:bg-danger/25 disabled:opacity-50",
    chip:
      "h-9 rounded-full px-3 border border-border bg-raised font-mono text-fg hover:border-border-strong disabled:opacity-50",
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center text-sm font-semibold transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${styles} ${className}`}
      {...props}
    />
  );
}

const inputBase =
  "h-11 w-full rounded-[10px] border border-border bg-raised px-3 text-[15px] text-fg placeholder:text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputBase} ${className}`} {...props} />;
}

const chevron =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%239BA0AA' stroke-width='2.5' stroke-linecap='round'><path d='m6 9 6 6 6-6'/></svg>\")";

export function Select({
  className = "",
  style,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`${inputBase} appearance-none bg-no-repeat pr-9 ${className}`}
      style={{
        backgroundImage: chevron,
        backgroundPosition: "right 0.7rem center",
        ...style,
      }}
      {...props}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

const accentStripe = {
  workout: "bg-volt",
  food: "bg-food",
  water: "bg-water",
  body: "bg-body",
} as const;

export function Card({
  title,
  children,
  className = "",
  accent,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  accent?: keyof typeof accentStripe;
}) {
  return (
    <section
      className={`relative rounded-2xl border border-border bg-surface p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] ${className}`}
    >
      {accent && (
        <span
          aria-hidden
          className={`absolute bottom-3.5 left-0 top-3.5 w-[3px] rounded-full ${accentStripe[accent]}`}
        />
      )}
      {title && <h2 className="mb-3 text-lg font-bold">{title}</h2>}
      {children}
    </section>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="text-sm text-danger">{children}</p>;
}
