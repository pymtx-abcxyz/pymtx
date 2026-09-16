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
