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
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary:
      "bg-accent text-bg font-semibold hover:brightness-110 disabled:opacity-50",
    ghost: "bg-surface-2 text-fg hover:bg-border disabled:opacity-50",
    danger: "bg-danger/20 text-danger hover:bg-danger/30 disabled:opacity-50",
  }[variant];
  return (
    <button
      className={`rounded-lg px-4 py-2 text-sm transition-colors ${styles} ${className}`}
      {...props}
    />
  );
}

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none ${className}`}
      {...props}
    />
  );
}

export function Select({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none ${className}`}
      {...props}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl bg-surface p-4 ${className}`}>
      {title && <h2 className="mb-3 text-lg font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="text-sm text-danger">{children}</p>;
}
