import horizontalLight from "@/assets/erfstop-logo-horizontal-light.svg.asset.json";
import horizontalDark from "@/assets/erfstop-logo-horizontal-dark.svg.asset.json";
import stackedLight from "@/assets/erfstop-logo-stacked-light.svg.asset.json";
import stackedDark from "@/assets/erfstop-logo-stacked-dark.svg.asset.json";
import wordmarkLight from "@/assets/erfstop-wordmark-light.svg.asset.json";
import wordmarkDark from "@/assets/erfstop-wordmark-dark.svg.asset.json";
import mark from "@/assets/erfstop-mark-navy.svg.asset.json";

interface AtlasPinProps {
  className?: string;
  title?: string;
  /**
   * Logo variant:
   *  - `mark`            → square icon mark (navy on transparent) — favicons, pins, compact UI
   *  - `horizontal`      → full horizontal logo for LIGHT backgrounds (nav, footer, light cards)
   *  - `white`           → full horizontal logo for DARK navy backgrounds
   *  - `stacked`         → stacked icon + wordmark for LIGHT bgs — auth, empty states, centered hero
   *  - `stacked-white`   → stacked logo on DARK navy bgs
   *  - `wordmark`        → wordmark only (no icon) for LIGHT bgs — tight inline use
   *  - `wordmark-white`  → wordmark only for DARK bgs
   */
  variant?:
    | "mark"
    | "horizontal"
    | "white"
    | "stacked"
    | "stacked-white"
    | "wordmark"
    | "wordmark-white";
}

const SRC: Record<NonNullable<AtlasPinProps["variant"]>, string> = {
  mark: mark.url,
  horizontal: horizontalLight.url,
  white: horizontalDark.url,
  stacked: stackedLight.url,
  "stacked-white": stackedDark.url,
  wordmark: wordmarkLight.url,
  "wordmark-white": wordmarkDark.url,
};

export function AtlasPin({ className, title = "ErfStop", variant = "mark" }: AtlasPinProps) {
  return <img src={SRC[variant]} alt={title} className={className} draggable={false} />;
}

export function ErfStopLogo(props: AtlasPinProps) {
  return <AtlasPin {...props} />;
}
