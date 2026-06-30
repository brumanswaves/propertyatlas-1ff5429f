import type { ReactNode } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="flex-1 px-6 pb-16 pt-28">
        <article className="mx-auto max-w-3xl">
          <header className="mb-8 border-b border-border pb-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              ErfStop
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {title}
            </h1>
            {intro && (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{intro}</p>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">
              Last updated: {new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </header>
          <div className="prose-legal space-y-6 text-[14px] leading-relaxed text-foreground/90">
            {children}
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="space-y-2 text-[13.5px] leading-relaxed text-foreground/85">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="ml-5 list-disc space-y-1 text-[13.5px] leading-relaxed text-foreground/85 marker:text-muted-foreground">
      {items.map((it) => (
        <li key={it}>{it}</li>
      ))}
    </ul>
  );
}

export function LegalCallout({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 text-[13px] leading-relaxed text-foreground">
      {children}
    </div>
  );
}
