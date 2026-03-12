import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/app-shell";
import { OrganizationJsonLd, WebsiteJsonLd, SoftwareApplicationJsonLd } from "@/components/json-ld";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_URL = "https://albertapulsecheck.ca";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Alberta Pulse Check — Economic Intelligence for Alberta",
    template: "%s | Alberta Pulse Check",
  },
  description:
    "Real-time economic, real estate, and municipal data for Alberta. Live data from 8+ government sources across 22 municipalities — permits, assessments, energy, labour, migration, and more.",
  keywords: [
    "Alberta economy", "Alberta real estate data", "Edmonton economic data",
    "Alberta building permits", "Alberta municipal data", "Calgary real estate",
    "Alberta energy data", "Alberta housing market", "Alberta economic dashboard",
    "Alberta business intelligence", "Alberta population growth",
  ],
  authors: [{ name: "Alberta Pulse Check" }],
  creator: "Alberta Pulse Check",
  publisher: "Alberta Pulse Check",
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: BASE_URL,
    siteName: "Alberta Pulse Check",
    title: "Alberta Pulse Check — Economic Intelligence for Alberta",
    description:
      "Real-time economic, real estate, and municipal data for Alberta. Live data from 8+ government sources across 22 municipalities.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Alberta Pulse Check — Economic Intelligence for Alberta",
    description:
      "Real-time economic, real estate, and municipal data for Alberta. Live data from 8+ government sources across 22 municipalities.",
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
    canonical: BASE_URL,
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
