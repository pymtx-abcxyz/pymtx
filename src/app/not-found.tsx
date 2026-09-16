import Link from "next/link";
import { PymtxLogotype } from "@/components/pymtx-mark";
import { PortalShell } from "@/components/ui";

export default function NotFound() {
  return (
    <PortalShell grain>
      <main className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="max-w-md text-center">
          <Link href="/" className="inline-block text-2xl text-sage-bright">
            <PymtxLogotype />
          </Link>
          <h1 className="mt-8 font-display text-3xl font-bold text-mist">
            Page not found
          </h1>
          <p className="mt-3 text-sage/85">
            That route doesn’t exist. Head back to the product or open a portal.
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
