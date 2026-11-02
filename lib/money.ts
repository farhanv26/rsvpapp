/** Money is stored as integer minor units (cents, paise…) of the wedding's currency. No floats. */
export const SUPPORTED_CURRENCIES = ["USD", "CAD", "GBP", "EUR", "AUD", "INR", "PKR", "BDT", "AED", "SAR", "NZD", "SGD"] as const;

export function currencyDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** Parses "1,250.50" (or "1250") into minor units. Returns null for anything ambiguous or invalid. */
export function parseMoneyToMinor(input: unknown, currency: string): number | null {
  if (typeof input !== "string" && typeof input !== "number") return null;
  const raw = String(input).trim().replace(/^(?:[$£€₹]|(?:USD|CAD|GBP|EUR|AUD|INR|PKR|BDT|AED|SAR|NZD|SGD)\s+)\s*/i, "");
  if (!raw) return null;
  if (!/^\d{1,3}(,\d{3})*(\.\d+)?$|^\d+(\.\d+)?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.replace(/,/g, "").split(".");
  const digits = currencyDigits(currency);
  if (fraction.length > digits) return null;
  const minor = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, "0") || "0");
  return Number.isSafeInteger(minor) && minor <= 2_000_000_000 ? minor : null;
}

export function formatMinor(minor: number, currency: string): string {
  const digits = currencyDigits(currency);
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
      minor / 10 ** digits,
    );
  } catch {
    return `${(minor / 10 ** digits).toFixed(digits)} ${currency}`;
  }
}

/** For prefilling inputs: 125050 → "1250.50". */
export function minorToInput(minor: number | null | undefined, currency: string): string {
  if (minor === null || minor === undefined) return "";
  const digits = currencyDigits(currency);
  const whole = Math.trunc(minor / 10 ** digits);
  const fraction = String(minor % 10 ** digits).padStart(digits, "0");
  return digits > 0 ? `${whole}.${fraction}` : String(whole);
}
