import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Request access",
  description:
    "Tamrack is invite-only during early access. Tell us what you'd use it for and we'll be in touch.",
  alternates: { canonical: "https://tamrack.ca/access-request" },
};

export default function AccessRequestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
