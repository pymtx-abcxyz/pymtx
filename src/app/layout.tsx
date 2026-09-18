import type { Metadata } from "next";
import { Fragment_Mono, Geist } from "next/font/google";
import { cookies } from "next/headers";
import Script from "next/script";
import { AppearanceProvider } from "@/components/appearance-provider";
import {
  APPEARANCE_BOOT_SCRIPT,
  APP_THEME_STORAGE_KEY,
  AppTheme,
  isAppTheme,
  type AppTheme as AppThemeType,
} from "@/lib/appearance";
import "./tokens.css";
import "./globals.css";

/** Body / UI sans — modern weights for hierarchy. */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

/** Logo mark + code accents — Fragment Mono regular only. */
const monotype = Fragment_Mono({
  variable: "--font-monotype",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
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

/** Enable iOS safe-area insets for footer / sheet padding. */
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

async function readThemeCookie(): Promise<AppThemeType> {
  try {
    const jar = await cookies();
    const raw = jar.get(APP_THEME_STORAGE_KEY)?.value;
    return isAppTheme(raw) ? raw : AppTheme.system;
  } catch {
    return AppTheme.system;
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await readThemeCookie();
  const colorScheme =
    theme === AppTheme.system ? "light dark" : theme;

  return (
    <html
      lang="en-CA"
      className={`${geistSans.variable} ${monotype.variable} h-full antialiased`}
      data-theme={theme}
      style={{ colorScheme }}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans text-text-primary bg-canvas">
        <Script
          id="pymtx-appearance-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT_SCRIPT }}
        />
        <AppearanceProvider>{children}</AppearanceProvider>
      </body>
    </html>
  );
}
