import navLight from "@/assets/erfstoep-nav-light.png.asset.json";
import navDark from "@/assets/erfstoep-nav-dark.png.asset.json";
import mainLight from "@/assets/erfstoep-main-light.png.asset.json";
import mainDark from "@/assets/erfstoep-main-dark.png.asset.json";
import stackedLight from "@/assets/erfstoep-stacked-light.png.asset.json";
import stackedDark from "@/assets/erfstoep-stacked-dark.png.asset.json";
import wordmarkLight from "@/assets/erfstoep-wordmark-light.png.asset.json";
import wordmarkDark from "@/assets/erfstoep-wordmark-dark.png.asset.json";
import mark from "@/assets/erfstoep-mark.png.asset.json";

interface AtlasPinProps {
  className?: string;
  title?: string;
  /**
   * ErfStoep logo variant. The navy/orange brand has explicit light and dark
   * background variants — use `*-white` / `stacked-white` / `wordmark-white` on
   * dark navy surfaces (e.g. auth screen, hero overlays).
   *
   *  - `mark`            → square house-pin icon only (favicons, pins, small cards, mobile)
   *  - `horizontal`      → nav logo (icon + ErfStoep wordmark) for light backgrounds
   *  - `horizontal-sm`   → alias of `horizontal` (kept for API compatibility)
   *  - `white`           → nav logo tuned for dark backgrounds
   *  - `stacked`         → large stacked lockup (icon over wordmark) for light backgrounds
   *  - `stacked-white`   → stacked lockup for dark backgrounds
   *  - `wordmark`        → wordmark-only for light backgrounds
   *  - `wordmark-white`  → wordmark-only for dark backgrounds
   *
   * Never recolor, distort, or alter the logo.
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
  mark: mark.url,
  horizontal: navLight.url,
  "horizontal-sm": navLight.url,
  white: navDark.url,
  stacked: stackedLight.url,
  "stacked-white": stackedDark.url,
  wordmark: wordmarkLight.url,
  "wordmark-white": wordmarkDark.url,
};

// Suppress unused-import noise for assets retained for API completeness.
void mainLight;
void mainDark;

/**
 * ErfStoep brand mark (navy + orange, no slogan). Backwards-compatible name (AtlasPin).
 * The logo is shipped as a single artwork — do not recolor, crop, distort, or overlay text.
 */
export function AtlasPin({ className, title = "ErfStoep", variant = "mark" }: AtlasPinProps) {
  return <img src={SRC[variant]} alt={title} className={className} draggable={false} />;
}

export function ErfStoepLogo(props: AtlasPinProps) {
  return <AtlasPin {...props} />;
}
