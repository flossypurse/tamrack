import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Alberta Pulse API Documentation",
  description: "REST API reference for Alberta Pulse Check — programmatic access to permits, assessments, signals, macro data, and municipality analytics.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
