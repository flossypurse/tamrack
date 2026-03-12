import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compare Alberta Municipalities",
  description: "Side-by-side comparison of up to 5 Alberta municipalities — permits, assessments, population growth, business activity, and more.",
};

export default function CompareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
