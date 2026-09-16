/** Compact nav / chrome mark — Fragment Mono regular (no faux-bold). */
export function PymtxLogotype({ className }: { className?: string }) {
  return (
    <span
      className={`font-display lowercase tracking-tight ${className ?? ""}`}
    >
      pymtx
    </span>
  );
}
