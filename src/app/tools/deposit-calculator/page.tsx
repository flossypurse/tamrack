import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Scale } from "lucide-react";
import { DepositCalculator } from "./calculator";

export const metadata: Metadata = {
  title: "Alberta Security Deposit Interest Calculator — Official Rates",
  description:
    "Calculate interest owed on rental security deposits using official Alberta rates. Year-by-year breakdown and downloadable PDF report.",
};

export default function DepositCalculatorPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Alberta Security Deposit Calculator"
        category="tools"
        icon={<Scale size={22} />}
        description="Calculate interest owed on rental security deposits using official Alberta rates. Download a PDF report for your records."
      />
      <DepositCalculator />
    </main>
  );
}
