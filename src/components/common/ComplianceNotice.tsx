import { ShieldAlert } from "lucide-react";

interface Props {
  tone?: "default" | "soft";
  children?: React.ReactNode;
}

const DEFAULT_TEXT =
  "PropertyAtlas helps organize property research from public sources, user notes, and third-party reports. " +
  "Official records and valuations should be verified through the relevant provider.";

export function ComplianceNotice({ tone = "default", children }: Props) {
  return (
    <div
      className={
        "mt-4 flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] leading-snug " +
        (tone === "soft"
          ? "border-border/60 bg-muted/40 text-muted-foreground"
          : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200")
      }
    >
      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p>{children ?? DEFAULT_TEXT}</p>
    </div>
  );
}
