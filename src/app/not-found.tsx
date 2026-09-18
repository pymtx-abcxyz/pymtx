import Link from "next/link";
import { PymtxLogotype } from "@/components/pymtx-mark";
import { PortalShell } from "@/components/ui";

export default function NotFound() {
  return (
    <PortalShell grain>
      <main className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="glass-panel max-w-md px-8 py-10 text-center">
          <Link
            href="/"
            className="inline-block text-[length:var(--text-2xl)] text-text-primary"
            aria-label="pymtx home"
          >
            <PymtxLogotype />
          </Link>
          <h1 className="mt-8 font-sans text-[length:var(--text-3xl)] font-bold text-text-primary">
            Page not found
          </h1>
          <p className="mt-3 text-[length:var(--text-base)] text-text-secondary">
            That route doesn&apos;t exist. Head back to the product or open a
            portal.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className="btn-primary">
              Home
            </Link>
            <Link href="/login" className="btn-ghost">
              Staff sign in
            </Link>
          </div>
        </div>
      </main>
    </PortalShell>
  );
}
