/** Compact nav / chrome mark — Fragment Mono (logo accent only). */
export function PymtxLogotype({ className }: { className?: string }) {
  return (
    <span
      className={`font-display lowercase tracking-tight ${className ?? ""}`}
    >
      pymtx
    </span>
  );
}
