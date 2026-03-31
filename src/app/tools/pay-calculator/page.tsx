import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Calculator } from "lucide-react";
import { PayCalculator } from "./calculator";

export const metadata: Metadata = {
  title: "Alberta Take-Home Pay Calculator — Net Pay After Tax, CPP & EI",
  description:
    "See your net pay after federal tax, Alberta provincial tax, CPP, CPP2, and EI deductions — broken down by pay period. Updated for 2026.",
};

export default function PayCalculatorPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Alberta Take-Home Pay Calculator"
        category="tools"
        icon={<Calculator size={22} />}
        description="See your net pay after federal tax, Alberta tax, CPP, CPP2, and EI deductions — by pay period. Updated for 2026."
      />
      <PayCalculator />
    </main>
  );
}
