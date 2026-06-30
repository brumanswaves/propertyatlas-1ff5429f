import horizontalLight from "@/assets/erfstop-logo-horizontal-light.svg.asset.json";
import horizontalDark from "@/assets/erfstop-logo-horizontal-dark.svg.asset.json";
import mark from "@/assets/erfstop-mark-navy.svg.asset.json";

interface AtlasPinProps {
  className?: string;
  title?: string;
  variant?: "mark" | "horizontal" | "white";
}

/**
 * ErfStop brand mark — navy/orange identity. Backwards-compatible name (AtlasPin).
 * - `mark`        → square icon mark, navy on transparent (use anywhere)
 * - `horizontal`  → full horizontal logo for LIGHT backgrounds (dark text)
 * - `white`       → full horizontal logo for DARK navy backgrounds (light text)
 */
export function AtlasPin({ className, title = "ErfStop", variant = "mark" }: AtlasPinProps) {
  const src =
    variant === "horizontal"
      ? horizontalLight.url
      : variant === "white"
      ? horizontalDark.url
      : mark.url;
  return <img src={src} alt={title} className={className} draggable={false} />;
}

export function ErfStopLogo(props: AtlasPinProps) {
  return <AtlasPin {...props} />;
}
