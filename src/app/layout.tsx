import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alberta Pulse Check — Economic Intelligence Dashboard",
  description:
    "Real-time economic, business, and development data for Alberta. Built for decision-makers in Parkland County and the Edmonton metro region.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        <Nav />
        {/* Mobile top bar spacer */}
        <div className="lg:hidden h-[52px]" />
        {/* Content offset for desktop sidebar */}
        <div className="lg:pl-56">
          {children}
        </div>
      </body>
    </html>
  );
}
