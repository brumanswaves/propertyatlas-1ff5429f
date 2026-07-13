interface AtlasPinProps {
  className?: string;
  title?: string;
  /**
   * Easy Erf logo variant. These variants point to the approved locked artwork.
   * Never recolor, distort, crop, or alter the logo proportions.
   *
   * - `mark`            -> icon mark only
   * - `horizontal`      -> nav logo for light backgrounds
   * - `horizontal-sm`   -> alias of `horizontal`
   * - `white`           -> dark-header logo pill
   * - `stacked`         -> primary logo lockup
   * - `stacked-white`   -> alias of `stacked`
   * - `wordmark`        -> nav logo
   * - `wordmark-white`  -> dark-header logo pill
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
  mark: "/easy-erf/icons/easy-erf-icon-mark-transparent.png",
  horizontal: "/easy-erf/logos/easy-erf-nav-logo-transparent.png",
  "horizontal-sm": "/easy-erf/logos/easy-erf-nav-logo-transparent.png",
  white: "/easy-erf/logos/easy-erf-dark-header-logo-pill.png",
  stacked: "/easy-erf/logos/easy-erf-primary-logo-transparent.png",
  "stacked-white": "/easy-erf/logos/easy-erf-primary-logo-transparent.png",
  wordmark: "/easy-erf/logos/easy-erf-nav-logo-transparent.png",
  "wordmark-white": "/easy-erf/logos/easy-erf-dark-header-logo-pill.png",
};

/**
 * Easy Erf brand mark. Backwards-compatible component name (AtlasPin).
 * The logo is shipped as a single artwork; do not recolor, crop, distort, or overlay text.
 */
export function AtlasPin({ className, title = "Easy Erf", variant = "mark" }: AtlasPinProps) {
  return <img src={SRC[variant]} alt={title} className={className} draggable={false} />;
}

export function EasyErfLogo(props: AtlasPinProps) {
  return <AtlasPin {...props} />;
}
