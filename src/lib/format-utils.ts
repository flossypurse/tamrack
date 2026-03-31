/**
 * Shared formatting utilities for calculators and display.
 */

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencyCents(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(rate: number, decimals = 1): string {
  return `${(rate * 100).toFixed(decimals)}%`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-CA").format(n);
}
