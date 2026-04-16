/**
 * Structured phone handling: country dial code + national digits, plus legacy full-string parsing.
 * WhatsApp URLs use digits only: https://wa.me/<digits>?text=…
 */

/** Shown near phone fields in admin guest forms. */
export const WHATSAPP_PHONE_HELPER_TEXT =
  "Use country code and local number. North America: 10 digits. UK: 07… or digits after +44.";

/** Inline when a value is present but cannot be normalized for wa.me. */
export const WHATSAPP_PHONE_INVALID_INLINE = "Invalid phone number";

export const WHATSAPP_MISSING_COUNTRY = "Missing country code";

export const DEFAULT_PHONE_COUNTRY = "+1";

/** Common destinations; admins can still type other codes via legacy full phone when needed. */
export const PHONE_COUNTRY_OPTIONS: { value: string; label: string }[] = [
  { value: "+1", label: "United States / Canada (+1)" },
  { value: "+44", label: "United Kingdom (+44)" },
  { value: "+65", label: "Singapore (+65)" },
  { value: "+60", label: "Malaysia (+60)" },
  { value: "+61", label: "Australia (+61)" },
  { value: "+64", label: "New Zealand (+64)" },
  { value: "+91", label: "India (+91)" },
  { value: "+92", label: "Pakistan (+92)" },
  { value: "+971", label: "UAE (+971)" },
  { value: "+966", label: "Saudi Arabia (+966)" },
  { value: "+974", label: "Qatar (+974)" },
  { value: "+973", label: "Bahrain (+973)" },
  { value: "+968", label: "Oman (+968)" },
  { value: "+965", label: "Kuwait (+965)" },
  { value: "+962", label: "Jordan (+962)" },
  { value: "+20", label: "Egypt (+20)" },
  { value: "+27", label: "South Africa (+27)" },
  { value: "+234", label: "Nigeria (+234)" },
  { value: "+254", label: "Kenya (+254)" },
  { value: "+62", label: "Indonesia (+62)" },
  { value: "+63", label: "Philippines (+63)" },
  { value: "+66", label: "Thailand (+66)" },
  { value: "+84", label: "Vietnam (+84)" },
  { value: "+86", label: "China (+86)" },
  { value: "+852", label: "Hong Kong (+852)" },
  { value: "+853", label: "Macau (+853)" },
  { value: "+886", label: "Taiwan (+886)" },
  { value: "+81", label: "Japan (+81)" },
  { value: "+82", label: "South Korea (+82)" },
  { value: "+33", label: "France (+33)" },
  { value: "+49", label: "Germany (+49)" },
  { value: "+39", label: "Italy (+39)" },
  { value: "+34", label: "Spain (+34)" },
  { value: "+31", label: "Netherlands (+31)" },
  { value: "+32", label: "Belgium (+32)" },
  { value: "+41", label: "Switzerland (+41)" },
  { value: "+43", label: "Austria (+43)" },
  { value: "+45", label: "Denmark (+45)" },
  { value: "+46", label: "Sweden (+46)" },
  { value: "+47", label: "Norway (+47)" },
  { value: "+353", label: "Ireland (+353)" },
  { value: "+351", label: "Portugal (+351)" },
  { value: "+30", label: "Greece (+30)" },
  { value: "+48", label: "Poland (+48)" },
  { value: "+90", label: "Turkey (+90)" },
  { value: "+972", label: "Israel (+972)" },
  { value: "+880", label: "Bangladesh (+880)" },
  { value: "+94", label: "Sri Lanka (+94)" },
];

export function dialDigitsFromCountryCode(countryCode: string): string {
  return countryCode.replace(/\D/g, "");
}

/**
 * Legacy: one string that may include +, spaces, UK 0, NANP 10-digit, etc.
 * (Same rules as previous app version — do not guess country from partial digit prefixes.)
 */
export function normalizePhoneForWhatsApp(phone: string | null | undefined): string | null {
  if (phone == null) return null;
  const trimmed = String(phone).trim();
  if (!trimmed) return null;

  const hadPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (!digits.length) return null;

  if (hadPlus) {
    if (digits.startsWith("00")) {
      digits = digits.slice(2);
    }
    if (digits.length < 8 || digits.length > 15) return null;
    return digits;
  }

  if (digits.startsWith("00") && digits.length >= 12) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("0")) {
    if (digits.length >= 10 && digits.length <= 11) {
      const normalized = `44${digits.slice(1)}`;
      if (normalized.length >= 11 && normalized.length <= 15) return normalized;
    }
    return null;
  }

  if (digits.length === 10) {
    return `1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return digits;
  }

  if (digits.length > 10 && digits.length <= 15) {
    return digits;
  }

  return null;
}

/**
 * Structured: `phoneCountryCode` like "+1", `nationalPhone` digits only (national significant).
 */
export function normalizeStructuredPhoneForWhatsApp(
  phoneCountryCode: string | null | undefined,
  nationalPhone: string | null | undefined,
): string | null {
  const ccRaw = phoneCountryCode?.trim();
  if (!ccRaw) return null;
  const dial = dialDigitsFromCountryCode(ccRaw);
  if (!dial.length) return null;

  let national = String(nationalPhone ?? "").replace(/\D/g, "");
  if (!national.length) return null;

  if (dial === "44" && national.startsWith("0")) {
    national = national.slice(1);
  }

  const full = dial + national;
  if (full.length < 8 || full.length > 15) return null;
  return full;
}

export function normalizePhoneForWhatsAppGuestRecord(guest: {
  phone: string | null | undefined;
  phoneCountryCode?: string | null;
}): string | null {
  if (guest.phoneCountryCode?.trim()) {
    return normalizeStructuredPhoneForWhatsApp(guest.phoneCountryCode, guest.phone);
  }
  return normalizePhoneForWhatsApp(guest.phone);
}

/** Visual-only formatting for national digits while typing. */
export function formatNationalDigitsDisplay(countryCode: string, nationalDigits: string): string {
  const d = nationalDigits.replace(/\D/g, "");

  if (countryCode === "+1") {
    if (d.length === 0) return "";
    if (d.length <= 3) return d.length < 3 ? d : `(${d})`;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
  }

  if (countryCode === "+44") {
    if (d.startsWith("0")) {
      if (d.length <= 5) return d;
      return `${d.slice(0, 5)} ${d.slice(5, 11)}`;
    }
    if (d.length <= 4) return d;
    return `${d.slice(0, 4)} ${d.slice(4, 12)}`;
  }

  return d.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

export function nationalDigitsMaxLength(countryCode: string): number {
  if (countryCode === "+1") return 10;
  if (countryCode === "+44") return 11;
  return 15;
}

/** Strip to digits and cap length for the selected country. */
export function sanitizeNationalDigitsInput(countryCode: string, raw: string): string {
  let d = raw.replace(/\D/g, "");
  const max = nationalDigitsMaxLength(countryCode);
  return d.slice(0, max);
}

/**
 * After legacy normalization, split E.164 digits into country + national for storage when possible.
 */
export function splitE164DigitsToGuestFields(
  fullDigits: string,
): { phoneCountryCode: string; national: string } | null {
  if (fullDigits.length < 10 || fullDigits.length > 15) return null;

  if (fullDigits.startsWith("1") && fullDigits.length === 11) {
    return { phoneCountryCode: "+1", national: fullDigits.slice(1) };
  }

  if (fullDigits.startsWith("44")) {
    const rest = fullDigits.slice(2);
    if (rest.length >= 9 && rest.length <= 10) {
      return { phoneCountryCode: "+44", national: rest };
    }
  }

  const sorted = [...PHONE_COUNTRY_OPTIONS.map((o) => dialDigitsFromCountryCode(o.value))].sort(
    (a, b) => b.length - a.length,
  );

  for (const prefix of sorted) {
    if (prefix === "1") continue;
    if (fullDigits.startsWith(prefix) && fullDigits.length > prefix.length) {
      const national = fullDigits.slice(prefix.length);
      if (national.length >= 6 && national.length <= 12) {
        const opt = PHONE_COUNTRY_OPTIONS.find((o) => dialDigitsFromCountryCode(o.value) === prefix);
        if (opt) {
          return { phoneCountryCode: opt.value, national };
        }
      }
    }
  }

  return null;
}

export type CsvPhoneImportResult = {
  phoneCountryCode: string | null;
  /** National digits when structured; legacy raw string when not split. */
  phone: string | null;
  whatsappDigits: string | null;
  /** Country label for preview when known. */
  countryLabel: string | null;
  validWhatsApp: boolean;
};

export function parseCsvPhoneRow(
  phoneRaw: string | undefined,
  phoneCountryCodeRaw: string | undefined,
): CsvPhoneImportResult {
  const phone = phoneRaw?.trim() ?? "";
  const ccInput = phoneCountryCodeRaw?.trim() ?? "";

  if (!phone && !ccInput) {
    return {
      phoneCountryCode: null,
      phone: null,
      whatsappDigits: null,
      countryLabel: null,
      validWhatsApp: false,
    };
  }

  if (ccInput) {
    const normalizedCc = ccInput.startsWith("+") ? ccInput : `+${ccInput.replace(/^\+/, "")}`;
    const dial = dialDigitsFromCountryCode(normalizedCc);
    const opt = PHONE_COUNTRY_OPTIONS.find((o) => dialDigitsFromCountryCode(o.value) === dial);
    const cc = opt?.value ?? (dial ? `+${dial}` : null);
    if (!cc) {
      const w = normalizePhoneForWhatsApp(phone);
      return {
        phoneCountryCode: null,
        phone: phone || null,
        whatsappDigits: w,
        countryLabel: null,
        validWhatsApp: w !== null,
      };
    }
    const national = sanitizeNationalDigitsInput(cc, phone);
    const w = normalizeStructuredPhoneForWhatsApp(cc, national);
    return {
      phoneCountryCode: cc,
      phone: national,
      whatsappDigits: w,
      countryLabel: opt?.label ?? cc,
      validWhatsApp: w !== null,
    };
  }

  const w = normalizePhoneForWhatsApp(phone);
  const split = w ? splitE164DigitsToGuestFields(w) : null;
  if (split) {
    const opt = PHONE_COUNTRY_OPTIONS.find((o) => o.value === split.phoneCountryCode);
    return {
      phoneCountryCode: split.phoneCountryCode,
      phone: split.national,
      whatsappDigits: w,
      countryLabel: opt?.label ?? split.phoneCountryCode,
      validWhatsApp: true,
    };
  }

  return {
    phoneCountryCode: null,
    phone: phone || null,
    whatsappDigits: w,
    countryLabel: null,
    validWhatsApp: w !== null,
  };
}

export function formatGuestPhoneLabel(guest: {
  phone: string | null | undefined;
  phoneCountryCode?: string | null;
}): string {
  const cc = guest.phoneCountryCode?.trim();
  const p = guest.phone?.trim();
  if (!p) return "";
  if (cc) {
    return `${cc} ${formatNationalDigitsDisplay(cc, p.replace(/\D/g, ""))}`;
  }
  return p;
}
