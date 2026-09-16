/**
 * Vector pymtx wordmark — embroidered patch / microprint treatment
 * matching charcoal–cream–violet brand mark (inline SVG, no raster).
 */

type MarkProps = {
  className?: string;
  title?: string;
};

export function PymtxWordmark({ className, title = "pymtx" }: MarkProps) {
  return (
    <svg
      viewBox="0 0 920 260"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <defs>
        {/* Dense stitch / microprint field */}
        <pattern
          id="pymtx-microprint"
          patternUnits="userSpaceOnUse"
          width="10"
          height="8"
        >
          <rect width="10" height="8" fill="#fea82f" />
          <path
            d="M0 1.5h10M0 4h10M0 6.5h10"
            stroke="#423e3b"
            strokeWidth="0.55"
            opacity="0.55"
          />
          <path
            d="M1 0v8M4 0v8M7 0v8"
            stroke="#2a2725"
            strokeWidth="0.35"
            opacity="0.4"
          />
        </pattern>
        <filter
          id="pymtx-mark-soft"
          x="-5%"
          y="-10%"
          width="110%"
          height="130%"
          colorInterpolationFilters="sRGB"
        >
          <feDropShadow
            dx="0"
            dy="5"
            stdDeviation="3.5"
            floodColor="#2a2725"
            floodOpacity="0.55"
          />
        </filter>
      </defs>

      <g
        fontFamily="var(--font-syne), Syne, system-ui, sans-serif"
        fontWeight="800"
        fontSize="176"
        letterSpacing="-0.04em"
        textAnchor="middle"
      >
        {/* Outer violet rim */}
        <text
          x="460"
          y="172"
          fill="none"
          stroke="#5448c8"
          strokeWidth="36"
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#pymtx-mark-soft)"
        >
          pymtx
        </text>

        {/* Cream patch band */}
        <text
          x="460"
          y="172"
          fill="#fffecb"
          stroke="#fffecb"
          strokeWidth="20"
          strokeLinejoin="round"
          paintOrder="stroke fill"
        >
          pymtx
        </text>

        {/* Stitch field + inner hairline */}
        <text
          x="460"
          y="172"
          fill="url(#pymtx-microprint)"
          stroke="#423e3b"
          strokeWidth="3.25"
          strokeLinejoin="round"
          paintOrder="stroke fill"
        >
          pymtx
        </text>
      </g>
    </svg>
  );
}

/** Compact nav / chrome mark. */
export function PymtxLogotype({ className }: { className?: string }) {
  return (
    <span
      className={`font-display font-bold lowercase tracking-tight ${className ?? ""}`}
    >
      pymtx
    </span>
  );
}
