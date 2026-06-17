import { ShieldAlert } from "lucide-react";

interface Props {
  tone?: "default" | "soft";
  variant?: "research" | "official";
  children?: React.ReactNode;
}

const DEFAULT_TEXT =
  "PropertyAtlas organizes research from public sources, user-entered notes, and third-party reports. " +
  "Always verify official property, zoning, valuation, ownership, and legal information with the relevant provider or municipality.";

const OFFICIAL_TEXT =
  "Public cadastral and municipal layers shown here are sourced live from official viewers (Chief Surveyor-General, Kouga Municipality). " +
  "PropertyAtlas does not own or warrant this data — verify with the source before relying on it.";

export function ComplianceNotice({ tone = "default", variant = "research", children }: Props) {
  const text = children ?? (variant === "official" ? OFFICIAL_TEXT : DEFAULT_TEXT);
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
      <p>{text}</p>
    </div>
  );
}
