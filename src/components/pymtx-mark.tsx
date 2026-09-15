/**
 * Vector pymtx wordmark — embroidered patch / microprint treatment
 * matching the navy–sage brand mark (inline SVG, no raster).
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
          <rect width="10" height="8" fill="#a8c0a4" />
          <path
            d="M0 1.5h10M0 4h10M0 6.5h10"
            stroke="#234836"
            strokeWidth="0.55"
            opacity="0.55"
          />
          <path
            d="M1 0v8M4 0v8M7 0v8"
            stroke="#2f5d4a"
            strokeWidth="0.35"
            opacity="0.35"
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
            floodColor="#04101c"
            floodOpacity="0.5"
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
        {/* Outer forest rim */}
        <text
          x="460"
          y="172"
          fill="none"
          stroke="#1e4335"
          strokeWidth="36"
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#pymtx-mark-soft)"
        >
          pymtx
        </text>

        {/* Sage patch band */}
        <text
          x="460"
          y="172"
          fill="#b7cdb2"
          stroke="#b7cdb2"
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
          stroke="#1e4335"
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
