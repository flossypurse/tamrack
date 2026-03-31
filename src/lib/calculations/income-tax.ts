import {
  FEDERAL_BRACKETS_2026,
  FEDERAL_BPA_2026,
  ALBERTA_BRACKETS_2026,
  ALBERTA_BPA_2026,
  CPP_2026,
  CPP2_2026,
  EI_2026,
  FEDERAL_CREDIT_RATE_2026,
  ALBERTA_CREDIT_RATE_2026,
} from "@/lib/constants/tools/tax-rates";

export type PayPeriod = "annual" | "monthly" | "biweekly" | "weekly";

export interface PayInputs {
  grossAnnualIncome: number;
  payPeriod: PayPeriod;
  rrspContribution: number;
}

export interface PayResult {
  grossAnnual: number;
  grossPerPeriod: number;

  // Deductions (annual)
  federalTax: number;
  albertaTax: number;
  cpp: number;
  cpp2: number;
  ei: number;
  rrsp: number;
  totalDeductions: number;

  // Net
  netAnnual: number;
  netPerPeriod: number;

  // Rates
  effectiveTotalRate: number;
  marginalFederalRate: number;
  marginalAlbertaRate: number;
  marginalCombinedRate: number;

  // Per-period breakdown
  periodsPerYear: number;
}

function calculateBracketTax(
  income: number,
  brackets: { min: number; max: number; rate: number }[]
): number {
  let tax = 0;
  for (const bracket of brackets) {
    if (income <= bracket.min) break;
    const taxableInBracket = Math.min(income, bracket.max) - bracket.min;
    tax += taxableInBracket * bracket.rate;
  }
  return tax;
}

function getMarginalRate(
  income: number,
  brackets: { min: number; max: number; rate: number }[]
): number {
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (income > brackets[i].min) return brackets[i].rate;
  }
  return brackets[0].rate;
}

function getPeriodsPerYear(period: PayPeriod): number {
  switch (period) {
    case "annual":
      return 1;
    case "monthly":
      return 12;
    case "biweekly":
      return 26;
    case "weekly":
      return 52;
  }
}

export function calculatePay(inputs: PayInputs): PayResult {
  const { grossAnnualIncome, payPeriod, rrspContribution } = inputs;
  const periodsPerYear = getPeriodsPerYear(payPeriod);

  // Taxable income after RRSP
  const taxableIncome = Math.max(0, grossAnnualIncome - rrspContribution);

  // Federal tax
  const grossFederalTax = calculateBracketTax(
    taxableIncome,
    FEDERAL_BRACKETS_2026
  );

  // Federal BPA credit (clawback for high income)
  let federalBPA = FEDERAL_BPA_2026.max;
  if (taxableIncome > FEDERAL_BPA_2026.clawbackEnd) {
    federalBPA = FEDERAL_BPA_2026.base;
  } else if (taxableIncome > FEDERAL_BPA_2026.clawbackStart) {
    const factor =
      (taxableIncome - FEDERAL_BPA_2026.clawbackStart) /
      (FEDERAL_BPA_2026.clawbackEnd - FEDERAL_BPA_2026.clawbackStart);
    federalBPA =
      FEDERAL_BPA_2026.max -
      factor * (FEDERAL_BPA_2026.max - FEDERAL_BPA_2026.base);
  }
  const federalBPACredit = federalBPA * FEDERAL_CREDIT_RATE_2026;

  // CPP credit at federal level
  const cpp = calculateCPP(grossAnnualIncome);
  const cpp2 = calculateCPP2(grossAnnualIncome);
  const cppFederalCredit = (cpp + cpp2) * FEDERAL_CREDIT_RATE_2026;

  // EI credit at federal level
  const ei = calculateEI(grossAnnualIncome);
  const eiFederalCredit = ei * FEDERAL_CREDIT_RATE_2026;

  const federalTax = Math.max(
    0,
    grossFederalTax - federalBPACredit - cppFederalCredit - eiFederalCredit
  );

  // Alberta tax
  const grossAlbertaTax = calculateBracketTax(
    taxableIncome,
    ALBERTA_BRACKETS_2026
  );
  const albertaBPACredit = ALBERTA_BPA_2026 * ALBERTA_CREDIT_RATE_2026;
  const cppAlbertaCredit = (cpp + cpp2) * ALBERTA_CREDIT_RATE_2026;
  const eiAlbertaCredit = ei * ALBERTA_CREDIT_RATE_2026;
  const albertaTax = Math.max(
    0,
    grossAlbertaTax - albertaBPACredit - cppAlbertaCredit - eiAlbertaCredit
  );

  // Total deductions
  const totalDeductions =
    federalTax + albertaTax + cpp + cpp2 + ei + rrspContribution;

  // Net
  const netAnnual = grossAnnualIncome - totalDeductions;

  // Marginal rates
  const marginalFederalRate = getMarginalRate(
    taxableIncome,
    FEDERAL_BRACKETS_2026
  );
  const marginalAlbertaRate = getMarginalRate(
    taxableIncome,
    ALBERTA_BRACKETS_2026
  );

  return {
    grossAnnual: grossAnnualIncome,
    grossPerPeriod: grossAnnualIncome / periodsPerYear,
    federalTax,
    albertaTax,
    cpp,
    cpp2,
    ei,
    rrsp: rrspContribution,
    totalDeductions,
    netAnnual,
    netPerPeriod: netAnnual / periodsPerYear,
    effectiveTotalRate:
      grossAnnualIncome > 0 ? totalDeductions / grossAnnualIncome : 0,
    marginalFederalRate,
    marginalAlbertaRate,
    marginalCombinedRate: marginalFederalRate + marginalAlbertaRate,
    periodsPerYear,
  };
}

function calculateCPP(grossIncome: number): number {
  const pensionableEarnings = Math.min(
    grossIncome,
    CPP_2026.maxPensionableEarnings
  );
  const contributoryEarnings = Math.max(
    0,
    pensionableEarnings - CPP_2026.basicExemption
  );
  return Math.min(contributoryEarnings * CPP_2026.rate, CPP_2026.maxContribution);
}

function calculateCPP2(grossIncome: number): number {
  if (grossIncome <= CPP_2026.maxPensionableEarnings) return 0;
  const cpp2Earnings = Math.min(grossIncome, CPP2_2026.secondCeiling) - CPP_2026.maxPensionableEarnings;
  return Math.min(
    Math.max(0, cpp2Earnings) * CPP2_2026.rate,
    CPP2_2026.maxContribution
  );
}

function calculateEI(grossIncome: number): number {
  const insurableEarnings = Math.min(grossIncome, EI_2026.maxInsurableEarnings);
  return Math.min(insurableEarnings * EI_2026.rate, EI_2026.maxPremium);
}
