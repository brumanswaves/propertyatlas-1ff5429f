interface AtlasPinProps {
  className?: string;
  title?: string;
}

/**
 * PropertyAtlas Atlas Pin — official master brand mark.
 * Do not redesign, restyle, or recolor. Use as-is at any size.
 */
export function AtlasPin({ className, title = "PropertyAtlas" }: AtlasPinProps) {
  return (
    <svg
      viewBox="0 0 280 320"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <path
        d="M140 0 C60 0 0 60 0 140 C0 250 140 320 140 320 C140 320 280 250 280 140 C280 60 220 0 140 0Z"
        fill="#0A3D62"
      />
      <path
        d="M140 40 C90 40 50 80 50 130"
        stroke="white"
        strokeWidth="24"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="120" y="95" width="55" height="55" fill="#0F8B8D" />
      <rect x="65" y="150" width="55" height="55" fill="#2bbec0" />
      <rect x="120" y="150" width="55" height="55" fill="#47d3cf" />
      <polygon points="175,95 225,95 225,145" fill="#D4A017" />
    </svg>
  );
}
