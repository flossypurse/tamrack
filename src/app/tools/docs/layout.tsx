import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tamrack API Documentation",
  description: "REST API reference for Tamrack — programmatic access to permits, assessments, signals, macro data, and municipality analytics.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
