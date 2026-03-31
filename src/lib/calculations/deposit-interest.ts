import {
  DEPOSIT_INTEREST_RATES,
  EARLIEST_YEAR,
  LATEST_YEAR,
} from "@/lib/constants/tools/deposit-rates";

export interface DepositInputs {
  depositAmount: number;
  tenancyStartDate: string; // ISO date string
  tenancyEndDate: string; // ISO date string
}

export interface YearBreakdown {
  periodStart: string;
  periodEnd: string;
  year: number;
  rate: number;
  daysInPeriod: number;
  daysInYear: number;
  interest: number;
}

export interface DepositResult {
  depositAmount: number;
  tenancyStartDate: string;
  tenancyEndDate: string;
  totalDays: number;
  totalInterest: number;
  totalOwed: number;
  yearBreakdown: YearBreakdown[];
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

function daysBetween(start: Date, end: Date): number {
  const msPerDay = 86_400_000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

export function calculateDepositInterest(
  inputs: DepositInputs
): DepositResult {
  const { depositAmount, tenancyStartDate, tenancyEndDate } = inputs;
  const start = new Date(tenancyStartDate);
  const end = new Date(tenancyEndDate);
  const totalDays = daysBetween(start, end);

  const yearBreakdown: YearBreakdown[] = [];
  let totalInterest = 0;

  // Walk through each calendar year the tenancy spans
  let current = new Date(start);
  while (current < end) {
    const year = current.getFullYear();
    const yearEnd = new Date(year + 1, 0, 1); // Jan 1 of next year
    const periodEnd = yearEnd < end ? yearEnd : end;
    const days = daysBetween(current, periodEnd);
    const totalDaysThisYear = daysInYear(year);

    // Get the rate for this year, default to 0 if outside our data range
    let rate = 0;
    if (year >= EARLIEST_YEAR && year <= LATEST_YEAR) {
      rate = DEPOSIT_INTEREST_RATES[year] ?? 0;
    }

    // Simple interest, prorated by days
    const interest = depositAmount * rate * (days / totalDaysThisYear);

    yearBreakdown.push({
      periodStart: current.toISOString().split("T")[0],
      periodEnd: periodEnd.toISOString().split("T")[0],
      year,
      rate,
      daysInPeriod: days,
      daysInYear: totalDaysThisYear,
      interest: Math.round(interest * 100) / 100,
    });

    totalInterest += interest;
    current = yearEnd;
  }

  totalInterest = Math.round(totalInterest * 100) / 100;

  return {
    depositAmount,
    tenancyStartDate,
    tenancyEndDate,
    totalDays,
    totalInterest,
    totalOwed: depositAmount + totalInterest,
    yearBreakdown,
  };
}
