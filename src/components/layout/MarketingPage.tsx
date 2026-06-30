import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { cn } from "@/lib/utils";

interface MarketingPageProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  intro?: string;
  heroCta?: { label: string; to: string };
  children: ReactNode;
}

export function MarketingPage({
  eyebrow = "ErfStoep",
  title,
  subtitle,
  intro,
  heroCta,
  children,
}: MarketingPageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="flex-1 pt-24 pb-16">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-card via-background to-card/40 px-6 py-14 sm:py-20">
          <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative mx-auto max-w-5xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-4 text-lg font-medium text-foreground/80 sm:text-xl">{subtitle}</p>
            )}
            {intro && (
              <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {intro}
              </p>
            )}
            {heroCta && (
              <Link
                to={heroCta.to}
                className="mt-7 inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:-translate-y-0.5 hover:shadow-glow"
              >
                {heroCta.label}
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-6 py-12">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-4 text-[14.5px] leading-relaxed text-foreground/85", className)}>
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="mb-6">
      {eyebrow && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>
      )}
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h2>
      {subtitle && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
    </header>
  );
}

export function Card({
  icon,
  title,
  children,
  accent,
}: {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-panel",
        accent && "border-primary/40 bg-gradient-to-br from-primary/5 via-card to-accent/5",
      )}
    >
      {icon && (
        <div className="mb-3 inline-grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand text-primary-foreground shadow-soft">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
      <div className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

export function NumberedStep({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="relative rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="absolute -top-3 left-5 inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-soft">
        Step {step}
      </div>
      <h3 className="mt-2 text-base font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

export function CTASection({
  title,
  description,
  primary,
  secondary,
}: {
  title: string;
  description: string;
  primary: { label: string; to: string };
  secondary?: { label: string; to: string };
}) {
  return (
    <section className="mt-12 overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-8 text-center shadow-panel sm:p-12">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">{description}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          to={primary.to}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft hover:-translate-y-0.5 hover:shadow-glow"
        >
          {primary.label}
          <ChevronRight className="h-4 w-4" />
        </Link>
        {secondary && (
          <Link
            to={secondary.to}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
          >
            {secondary.label}
          </Link>
        )}
      </div>
    </section>
  );
}
