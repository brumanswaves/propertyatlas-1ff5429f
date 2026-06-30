import navLogo from "@/assets/erfstop-nav-800.png.asset.json";
import navLogoSmall from "@/assets/erfstop-nav-400.png.asset.json";
import mainLogo from "@/assets/erfstop-logo-main.png.asset.json";
import icon from "@/assets/erfstop-icon.png.asset.json";

interface AtlasPinProps {
  className?: string;
  title?: string;
  /**
   * ErfStop logo variant. The wordmark file is identical in light/dark scenarios — the
   * navy "Erf" + orange "Stop" wordmark + house-pin icon reads correctly on both light
   * and dark navy surfaces, so the `white` / `stacked-white` aliases just resolve to the
   * same source. Never recolor, distort, or alter the logo.
   *
   *  - `mark`           → square house-pin icon only (favicons, pins, small cards, mobile)
   *  - `horizontal`     → full nav logo (icon + ErfStop wordmark) — default for headers
   *  - `horizontal-sm`  → smaller 400px nav logo for tight layouts
   *  - `white`          → alias of `horizontal` (logo works on dark navy bg as-is)
   *  - `stacked` / `stacked-white` / `wordmark` / `wordmark-white` → all resolve to the
   *    main no-slogan logo. Kept for API compatibility with earlier call sites.
   */
  variant?:
    | "mark"
    | "horizontal"
    | "horizontal-sm"
    | "white"
    | "stacked"
    | "stacked-white"
    | "wordmark"
    | "wordmark-white";
}

const SRC: Record<NonNullable<AtlasPinProps["variant"]>, string> = {
  mark: icon.url,
  horizontal: navLogo.url,
  "horizontal-sm": navLogoSmall.url,
  white: navLogo.url,
  stacked: mainLogo.url,
  "stacked-white": mainLogo.url,
  wordmark: navLogo.url,
  "wordmark-white": navLogo.url,
};

/**
 * ErfStop brand mark (navy + orange, no slogan). Backwards-compatible name (AtlasPin).
 * The logo is shipped as a single artwork — do not recolor, crop, distort, or overlay text.
 */
export function AtlasPin({ className, title = "ErfStop", variant = "mark" }: AtlasPinProps) {
  return <img src={SRC[variant]} alt={title} className={className} draggable={false} />;
}

export function ErfStopLogo(props: AtlasPinProps) {
  return <AtlasPin {...props} />;
}
