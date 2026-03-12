import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to Alberta Pulse Check — real-time economic intelligence for Alberta decision-makers.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
