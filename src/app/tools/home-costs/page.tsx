import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Home } from "lucide-react";
import { HomeCostsCalculator } from "./calculator";

export const metadata: Metadata = {
  title: "Alberta Home Buying Cost Calculator — Closing Costs, CMHC & More",
  description:
    "Calculate every cost to buy a home in Alberta — closing costs, land titles fees, CMHC insurance, lawyer fees, GST on new builds. Updated for 2026.",
};

export default function HomeCostsPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Alberta Home Buying Cost Calculator"
        category="tools"
        icon={<Home size={22} />}
        description="Calculate every cost to buy a home in Alberta — closing costs, land titles fees, CMHC insurance, lawyer fees, and more. Updated for 2026."
      />
      <HomeCostsCalculator />
    </main>
  );
}
