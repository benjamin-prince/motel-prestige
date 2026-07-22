import type { Currency } from "./types";

/** Default currency — always XAF. */
export const DEFAULT_CURRENCY = "XAF";

/**
 * Format an amount with space thousands separator and currency symbol.
 * Example: formatAmount(120000, { symbol: "FCFA", code: "XAF" })  → "120 000 FCFA"
 *          formatAmount(183.45, { symbol: "€", code: "EUR" })      → "183,45 €"
 */
export function formatAmount(amount: number | string, currency: Pick<Currency, "code" | "symbol">): string {
  const n = Number(amount);
  const isXaf = currency.code === "XAF";

  if (isXaf) {
    // XAF: no decimals, space as thousands separator (French/African style)
    const formatted = Math.round(n).toLocaleString("fr-FR").replace(/ /g, " ");
    return `${formatted} ${currency.symbol}`;
  }

  // Other currencies: 2 decimal places
  const formatted = n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${formatted} ${currency.symbol}`;
}

/**
 * Convert an XAF amount to another currency using the stored rate.
 * xaf_rate = how many XAF per 1 unit of target currency.
 */
export function xafToOther(amountXaf: number, targetRate: number): number {
  if (targetRate <= 0) return amountXaf;
  return amountXaf / targetRate;
}

export function otherToXaf(amount: number, xafRate: number): number {
  return amount * xafRate;
}

/** Returns a short label e.g. "120 000 FCFA (183,45 €)" */
export function formatWithConversion(
  amountXaf: number,
  xafCurrency: Pick<Currency, "code" | "symbol">,
  displayCurrency: Pick<Currency, "code" | "symbol" | "xaf_rate"> | null,
): string {
  const base = formatAmount(amountXaf, xafCurrency);
  if (!displayCurrency || displayCurrency.code === "XAF") return base;
  const converted = xafToOther(amountXaf, Number(displayCurrency.xaf_rate));
  return `${base} (${formatAmount(converted, displayCurrency)})`;
}
