import { redirect } from "next/navigation";

const redirects: Record<string, string> = {
  edo: "/edo/onboarding",
  learn: "/learn",
};

export default async function WaitlistPage({ params }: { params: Promise<{ product: string }> }) {
  const { product } = await params;
  const dest = redirects[product] || "/pricing";
  redirect(dest);
}
