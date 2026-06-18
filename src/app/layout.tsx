import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/app-shell";
import { OrganizationJsonLd, WebsiteJsonLd, SoftwareApplicationJsonLd } from "@/components/json-ld";
import { Analytics } from "@/components/analytics";
import { CookieConsent } from "@/components/cookie-consent";
import { SITE_URL } from "@/lib/constants/site";

// T3 Terminal type stack — see tamrack/brand/identity/typography.md
// Sans: Inter (running prose, UI labels, form fields)
// Mono: JetBrains Mono (wordmark companion, all data values, all section labels, code)
const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Tamrack — A data agent for Alberta",
    template: "%s — Tamrack",
  },
  description:
    "Ask a question, get the chart. Tamrack reads 180+ feeds across 16 Alberta government sources and renders the dashboard you asked for. The chart catalogue is free.",
  keywords: [
    "Alberta economy", "Alberta real estate data", "Edmonton economic data",
    "Alberta building permits", "Alberta municipal data", "Calgary real estate",
    "Alberta energy data", "Alberta housing market", "Alberta economic dashboard",
    "Alberta business intelligence", "Alberta population growth",
  ],
  authors: [{ name: "Tamrack" }],
  creator: "Tamrack",
  publisher: "Tamrack",
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: SITE_URL,
    siteName: "Tamrack",
    title: "Tamrack — A data agent for Alberta",
    description:
      "Ask a question, get the chart. 180+ feeds across 16 Alberta government sources, rendered on demand.",
    images: [
      {
        url: "/api/og?title=Tamrack&subtitle=A+data+agent+for+Alberta",
        width: 1200,
        height: 630,
        alt: "Tamrack — A data agent for Alberta",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tamrack — A data agent for Alberta",
    description:
      "Ask a question, get the chart. 180+ feeds across 16 Alberta government sources, rendered on demand.",
    images: ["/api/og?title=Tamrack&subtitle=A+data+agent+for+Alberta"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <OrganizationJsonLd />
        <WebsiteJsonLd />
        <SoftwareApplicationJsonLd />
      </head>
      <body
        className={`${sans.variable} ${mono.variable} antialiased min-h-screen`}
      >
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
        <Analytics />
        <CookieConsent />
      </body>
    </html>
  );
}
