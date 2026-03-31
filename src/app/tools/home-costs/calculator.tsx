"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader } from "@/components/card";
import {
  calculateHomeCosts,
  type HomeCostInputs,
} from "@/lib/calculations/home-costs";
import { TYPICAL_COSTS } from "@/lib/constants/tools/home-costs";
import { formatCurrency, formatPercent } from "@/lib/format-utils";
import { trackEvent } from "@/components/analytics";

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

export function HomeCostsCalculator() {
  const [purchasePrice, setPurchasePrice] = useState("450000");
  const [downPaymentPercent, setDownPaymentPercent] = useState("10");
  const [isNewConstruction, setIsNewConstruction] = useState(false);
  const [isFirstTimeBuyer, setIsFirstTimeBuyer] = useState(false);
  const [includeInspection, setIncludeInspection] = useState(true);
  const [includeTitleInsurance, setIncludeTitleInsurance] = useState(true);
  const [lawyerFees, setLawyerFees] = useState(String(TYPICAL_COSTS.lawyerFees.default));
  const [propertyTaxAdjustment, setPropertyTaxAdjustment] = useState(String(TYPICAL_COSTS.propertyTaxAdjustment.default));
  const [movingCosts, setMovingCosts] = useState(String(TYPICAL_COSTS.movingCosts.default));

  const result = useMemo(() => {
    const inputs: HomeCostInputs = {
      purchasePrice: Number(purchasePrice) || 0,
      downPaymentPercent: Number(downPaymentPercent) || 0,
      isNewConstruction,
      isFirstTimeBuyer,
      includeInspection,
      includeTitleInsurance,
      lawyerFees: Number(lawyerFees) || 0,
      propertyTaxAdjustment: Number(propertyTaxAdjustment) || 0,
      movingCosts: Number(movingCosts) || 0,
    };
    trackEvent("calculator_use", "tools", "home_costs");
    return calculateHomeCosts(inputs);
  }, [purchasePrice, downPaymentPercent, isNewConstruction, isFirstTimeBuyer, includeInspection, includeTitleInsurance, lawyerFees, propertyTaxAdjustment, movingCosts]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Left column: inputs + detailed results */}
      <div className="space-y-4">
        {/* Inputs */}
        <Card>
          <CardHeader title="Property Details" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Purchase price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted">$</span>
                <input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} min={0} step={1000} className="w-full pl-7 pr-3 py-2 text-sm rounded-lg bg-background border border-card-border text-foreground focus:outline-none focus:border-accent" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Down payment</label>
              <div className="relative">
                <input type="number" value={downPaymentPercent} onChange={(e) => setDownPaymentPercent(e.target.value)} min={5} max={100} step={1} className="w-full pr-8 pl-3 py-2 text-sm rounded-lg bg-background border border-card-border text-foreground focus:outline-none focus:border-accent" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">%</span>
              </div>
              <p className="text-[11px] text-muted/70 mt-1">{formatCurrency(result.downPayment)} — min 5% for insured</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mt-4">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={isNewConstruction} onChange={(e) => setIsNewConstruction(e.target.checked)} className="rounded accent-accent" />
              New construction <span className="text-muted text-xs">(GST applies)</span>
            </label>
            {isNewConstruction && (
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input type="checkbox" checked={isFirstTimeBuyer} onChange={(e) => setIsFirstTimeBuyer(e.target.checked)} className="rounded accent-accent" />
                First-time buyer <span className="text-muted text-xs">(enhanced rebate)</span>
              </label>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Additional Costs" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Lawyer / notary fees</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted">$</span>
                <input type="number" value={lawyerFees} onChange={(e) => setLawyerFees(e.target.value)} className="w-full pl-7 pr-3 py-2 text-sm rounded-lg bg-background border border-card-border text-foreground focus:outline-none focus:border-accent" />
              </div>
              <p className="text-[11px] text-muted/70 mt-1">Typical: {formatCurrency(TYPICAL_COSTS.lawyerFees.min)}–{formatCurrency(TYPICAL_COSTS.lawyerFees.max)}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Property tax adjustment</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted">$</span>
                <input type="number" value={propertyTaxAdjustment} onChange={(e) => setPropertyTaxAdjustment(e.target.value)} className="w-full pl-7 pr-3 py-2 text-sm rounded-lg bg-background border border-card-border text-foreground focus:outline-none focus:border-accent" />
              </div>
              <p className="text-[11px] text-muted/70 mt-1">Reimburse seller for prepaid tax</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Moving costs</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted">$</span>
                <input type="number" value={movingCosts} onChange={(e) => setMovingCosts(e.target.value)} className="w-full pl-7 pr-3 py-2 text-sm rounded-lg bg-background border border-card-border text-foreground focus:outline-none focus:border-accent" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mt-4">
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={includeInspection} onChange={(e) => setIncludeInspection(e.target.checked)} className="rounded accent-accent" />
              Home inspection <span className="text-muted text-xs">(~{formatCurrency(TYPICAL_COSTS.homeInspection.default)})</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={includeTitleInsurance} onChange={(e) => setIncludeTitleInsurance(e.target.checked)} className="rounded accent-accent" />
              Title insurance <span className="text-muted text-xs">(~{formatCurrency(TYPICAL_COSTS.titleInsurance.default)})</span>
            </label>
          </div>
        </Card>

        {/* Detailed results */}
        <Card>
          <CardHeader title="Government & Registration Fees" />
          <Row label="Land Titles registration" value={formatCurrency(result.landTitlesFee)} note="$50 base + $5 per $5,000 of purchase price" />
          <Row label="Mortgage registration" value={formatCurrency(result.mortgageRegistrationFee)} note="$50 base + $5 per $5,000 of mortgage" />
          {result.cmhcInsuranceRequired && (
            <Row label="CMHC mortgage insurance" value={formatCurrency(result.cmhcInsurance)} note="Required — down payment under 20%" />
          )}
        </Card>

        {isNewConstruction && (
          <Card>
            <CardHeader title="GST (New Construction)" />
            <Row label="GST (5%)" value={formatCurrency(result.gstAmount)} />
            {result.gstStandardRebate > 0 && (
              <Row label="Standard rebate" value={`-${formatCurrency(result.gstStandardRebate)}`} note="36% of GST, max $6,300" />
            )}
            {result.gstFirstTimeBuyerRebate > 0 && (
              <Row label="First-time buyer rebate" value={`-${formatCurrency(result.gstFirstTimeBuyerRebate)}`} note="100% rebate up to $1M (2026)" />
            )}
            <Row label="Net GST payable" value={formatCurrency(result.gstNet)} bold accent />
          </Card>
        )}

        <Card>
          <CardHeader title="Professional & Other Costs" />
          <Row label="Lawyer / notary fees" value={formatCurrency(result.lawyerFees)} />
          {result.homeInspection > 0 && <Row label="Home inspection" value={formatCurrency(result.homeInspection)} />}
          {result.titleInsurance > 0 && <Row label="Title insurance" value={formatCurrency(result.titleInsurance)} />}
          {result.propertyTaxAdjustment > 0 && <Row label="Property tax adjustment" value={formatCurrency(result.propertyTaxAdjustment)} />}
          {result.movingCosts > 0 && <Row label="Moving costs" value={formatCurrency(result.movingCosts)} />}
        </Card>

        {/* SEO content */}
        <Card>
          <div className="prose-sm space-y-3 text-sm text-muted">
            <h2 className="text-foreground text-base font-semibold">About Alberta Home Buying Costs</h2>
            <p>
              Buying a home in Alberta involves several costs beyond the purchase price.
              Unlike Ontario and British Columbia, Alberta does not charge a land transfer
              tax — saving buyers thousands. However, you will pay Land Titles registration
              fees, mortgage registration fees, and potentially CMHC mortgage insurance if
              your down payment is less than 20%.
            </p>
            <h3 className="text-foreground text-sm font-semibold">CMHC Insurance in Alberta</h3>
            <p>
              If your down payment is less than 20%, you must purchase mortgage default insurance.
              The premium ranges from 0.6% to 4% of your mortgage amount depending on your
              loan-to-value ratio. This can be added to your mortgage balance.
            </p>
            <h3 className="text-foreground text-sm font-semibold">GST on New Homes in Alberta</h3>
            <p>
              Alberta charges 5% GST (no provincial sales tax) on new construction homes.
              The standard new housing rebate returns 36% of GST paid, up to $6,300,
              for homes valued at $350,000 or less. As of 2026, first-time buyers can claim
              a 100% GST rebate on new homes up to $1,000,000.
            </p>
            <p className="text-[10px] font-mono text-muted/60">
              Sources: Alberta Land Titles, CMHC, CRA. Updated for 2026.
            </p>
          </div>
        </Card>
      </div>

      {/* Right column: summary */}
      <div className="space-y-4">
        <Card className="border-accent/30">
          <CardHeader title="Total Cash Needed" />
          <Row label="Down payment" value={formatCurrency(result.downPayment)} />
          <Row label="Closing costs" value={formatCurrency(result.totalClosingCosts)} />
          <Row label="Total cash to close" value={formatCurrency(result.totalCashNeeded)} bold accent />
        </Card>

        <Card>
          <CardHeader title="Mortgage Details" />
          <Row label="Mortgage amount" value={formatCurrency(result.mortgageAmount)} />
          <Row label="Loan-to-value" value={formatPercent(result.ltv, 1)} />
          {result.cmhcInsuranceRequired && (
            <Row label="CMHC insurance" value={formatCurrency(result.cmhcInsurance)} note="Added to mortgage balance" />
          )}
        </Card>

        <Card className="bg-accent/5 border-accent/20">
          <p className="text-sm font-medium text-foreground mb-1">Alberta advantage</p>
          <p className="text-xs text-muted leading-relaxed">
            Alberta has no land transfer tax — unlike Ontario and BC where it can
            cost 1-2% of the purchase price. Your main registration costs are just
            the Land Titles fees.
          </p>
        </Card>
      </div>
    </div>
  );
}
