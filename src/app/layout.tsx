import type { Metadata } from "next";
import { Figtree, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://pymtx.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "pymtx — Zero-Custody AR Settlement",
    template: "%s · pymtx",
  },
  description:
    "Ontario B2C accounts receivable settlement. Businesses stay Merchant of Record; customers settle via Rule H1 PADs.",
  applicationName: "pymtx",
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: siteUrl,
    siteName: "pymtx",
    title: "pymtx — Zero-Custody AR Settlement",
    description:
      "Past-due balances, settled directly — your business stays the creditor.",
  },
  twitter: {
    card: "summary",
    title: "pymtx",
    description: "Zero-custody AR settlement for Ontario SMBs.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-CA" className={`${syne.variable} ${figtree.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans text-mist">{children}</body>
    </html>
  );
}
