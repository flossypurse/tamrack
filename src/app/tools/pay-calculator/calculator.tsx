"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader } from "@/components/card";
import {
  calculatePay,
  type PayPeriod,
  type PayInputs,
} from "@/lib/calculations/income-tax";
import { formatCurrency, formatCurrencyCents, formatPercent } from "@/lib/format-utils";
import { trackEvent } from "@/components/analytics";

const PAY_PERIODS: { value: PayPeriod; label: string }[] = [
  { value: "annual", label: "Annual" },
  { value: "monthly", label: "Monthly (12/yr)" },
  { value: "biweekly", label: "Bi-weekly (26/yr)" },
  { value: "weekly", label: "Weekly (52/yr)" },
];

function Row({
  label,
  value,
  note,
  bold,
  accent,
}: {
  label: string;
  value: string;
  note?: string;
  bold?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline py-2 border-b border-card-border last:border-0">
      <div>
        <span className={bold ? "text-sm font-medium text-foreground" : "text-sm text-muted"}>
          {label}
        </span>
        {note && <span className="block text-[11px] text-muted/70 mt-0.5">{note}</span>}
      </div>
      <span
        className={`font-mono text-sm tabular-nums ${
          accent ? "text-accent font-semibold text-base" : bold ? "font-semibold text-foreground" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function PayCalculator() {
  const [grossIncome, setGrossIncome] = useState("75000");
  const [payPeriod, setPayPeriod] = useState<PayPeriod>("biweekly");
  const [rrspContribution, setRrspContribution] = useState("0");

  const result = useMemo(() => {
    const inputs: PayInputs = {
      grossAnnualIncome: Number(grossIncome) || 0,
      payPeriod,
      rrspContribution: Number(rrspContribution) || 0,
    };
    trackEvent("calculator_use", "tools", "pay_calculator");
    return calculatePay(inputs);
  }, [grossIncome, payPeriod, rrspContribution]);

  const periodLabel = PAY_PERIODS.find((o) => o.value === payPeriod)?.label.split(" ")[0] ?? "";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Left column */}
      <div className="space-y-4">
        <Card>
          <CardHeader title="Your Income" />
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Gross annual income</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted">$</span>
                <input type="number" value={grossIncome} onChange={(e) => setGrossIncome(e.target.value)} min={0} step={1000} className="w-full pl-7 pr-3 py-2 text-sm rounded-lg bg-background border border-card-border text-foreground focus:outline-none focus:border-accent" />
              </div>
              <p className="text-[11px] text-muted/70 mt-1">Total salary before deductions</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Pay period</label>
              <select value={payPeriod} onChange={(e) => setPayPeriod(e.target.value as PayPeriod)} className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-card-border text-foreground focus:outline-none focus:border-accent">
                {PAY_PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Annual RRSP contribution</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted">$</span>
                <input type="number" value={rrspContribution} onChange={(e) => setRrspContribution(e.target.value)} min={0} className="w-full pl-7 pr-3 py-2 text-sm rounded-lg bg-background border border-card-border text-foreground focus:outline-none focus:border-accent" />
              </div>
              <p className="text-[11px] text-muted/70 mt-1">Reduces taxable income</p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Income Tax" />
          <Row label="Federal income tax" value={formatCurrency(result.federalTax)} note={`Marginal rate: ${formatPercent(result.marginalFederalRate)}`} />
          <Row label="Alberta income tax" value={formatCurrency(result.albertaTax)} note={`Marginal rate: ${formatPercent(result.marginalAlbertaRate)}`} />
          <Row label="Total income tax" value={formatCurrency(result.federalTax + result.albertaTax)} bold />
        </Card>

        <Card>
          <CardHeader title="Payroll Deductions" />
          <Row label="CPP contributions" value={formatCurrencyCents(result.cpp)} note="5.95% on earnings $3,500–$74,600" />
          <Row label="CPP2 contributions" value={formatCurrencyCents(result.cpp2)} note="4% on earnings $74,600–$85,000" />
          <Row label="EI premiums" value={formatCurrencyCents(result.ei)} note="1.63% on earnings up to $68,900" />
          {result.rrsp > 0 && <Row label="RRSP contribution" value={formatCurrency(result.rrsp)} note="Pre-tax deduction" />}
        </Card>

        <Card>
          <CardHeader title="Annual Summary" />
          <Row label="Gross income" value={formatCurrency(result.grossAnnual)} />
          <Row label="Total deductions" value={`-${formatCurrency(result.totalDeductions)}`} />
          <Row label="Net annual income" value={formatCurrency(result.netAnnual)} bold accent />
          <Row label="Effective total rate" value={formatPercent(result.effectiveTotalRate)} note="All deductions as % of gross" />
        </Card>

        {/* SEO content */}
        <Card>
          <div className="prose-sm space-y-3 text-sm text-muted">
            <h2 className="text-foreground text-base font-semibold">Understanding Your Alberta Pay</h2>
            <p>
              Your take-home pay in Alberta is affected by federal income tax, Alberta
              provincial income tax, CPP contributions, CPP2 (the second additional CPP
              contribution introduced in 2024), and EI premiums.
            </p>
            <h3 className="text-foreground text-sm font-semibold">Alberta&apos;s 2026 Tax Brackets</h3>
            <p>
              Alberta introduced a new 8% bracket on the first $61,200 of income in mid-2025.
              For 2026, the full structure is: 8% up to $61,200, 10% to $154,259,
              12% to $185,111, 13% to $246,813, 14% to $370,220, and 15% above. Alberta
              has a $22,769 basic personal amount — the highest in Canada.
            </p>
            <h3 className="text-foreground text-sm font-semibold">What is CPP2?</h3>
            <p>
              Starting in 2024, a second CPP contribution (CPP2) applies to earnings between
              the first ceiling ($74,600 in 2026) and a second ceiling ($85,000) at 4%.
              Many calculators don&apos;t include this yet.
            </p>
            <p className="text-[10px] font-mono text-muted/60">
              Sources: CRA federal/provincial rates, CPP/EI maximums. Updated for 2026.
            </p>
          </div>
        </Card>
      </div>

      {/* Right column */}
      <div className="space-y-4">
        <Card className="border-accent/30">
          <CardHeader title={`Your ${periodLabel} Pay`} />
          <Row label={`Gross ${periodLabel.toLowerCase()}`} value={formatCurrencyCents(result.grossPerPeriod)} />
          <Row label="Deductions" value={`-${formatCurrencyCents(result.totalDeductions / result.periodsPerYear)}`} />
          <Row label={`Net ${periodLabel.toLowerCase()} pay`} value={formatCurrencyCents(result.netPerPeriod)} bold accent />
        </Card>

        <Card>
          <CardHeader title="Tax Rates" />
          <Row label="Effective total rate" value={formatPercent(result.effectiveTotalRate)} />
          <Row label="Marginal federal" value={formatPercent(result.marginalFederalRate)} />
          <Row label="Marginal Alberta" value={formatPercent(result.marginalAlbertaRate)} />
          <Row label="Marginal combined" value={formatPercent(result.marginalCombinedRate)} bold accent />
        </Card>

        <Card className="bg-accent/5 border-accent/20">
          <p className="text-sm font-medium text-foreground mb-1">Alberta&apos;s 2026 brackets</p>
          <p className="text-xs text-muted leading-relaxed">
            Alberta introduced an 8% bracket on the first $61,200 of income,
            lowering taxes for most Albertans. This calculator uses the current
            2026 rates.
          </p>
        </Card>
      </div>
    </div>
  );
}
