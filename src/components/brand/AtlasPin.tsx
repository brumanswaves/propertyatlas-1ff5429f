import horizontalLogo from "@/assets/erfstop-logo-horizontal.svg.asset.json";
import whiteLogo from "@/assets/erfstop-logo-white.svg.asset.json";
import mark from "@/assets/erfstop-mark.svg.asset.json";

interface AtlasPinProps {
  className?: string;
  title?: string;
  variant?: "mark" | "horizontal" | "white";
}

/**
 * ErfStop brand mark — official logo. Backwards-compatible export name (AtlasPin)
 * so all existing imports keep working after the ErfStop → ErfStop rebrand.
 * Use `variant="mark"` (default) for tight spaces / sidebar / saved cards,
 * `variant="horizontal"` for nav and hero, `variant="white"` on dark green surfaces.
 */
export function AtlasPin({ className, title = "ErfStop", variant = "mark" }: AtlasPinProps) {
  const src =
    variant === "horizontal"
      ? horizontalLogo.url
      : variant === "white"
      ? whiteLogo.url
      : mark.url;
  return <img src={src} alt={title} className={className} draggable={false} />;
}

export function ErfStopLogo(props: AtlasPinProps) {
  return <AtlasPin {...props} />;
}
