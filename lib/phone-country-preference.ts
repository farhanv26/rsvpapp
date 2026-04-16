/**
 * Browser locale → phone country picker id, plus localStorage for manual preference.
 * Used only for blank guest phone fields (no stored guest data).
 */

import { getPhoneCountryEntryById } from "@/lib/phone-country-data";

export const PHONE_COUNTRY_PREF_STORAGE_KEY = "rsvp_admin_phone_country_id";

/** ISO 3166-1 alpha-2 region → picker entry id (must exist in PHONE_COUNTRY_ENTRIES). */
const REGION_TO_COUNTRY_ID: Record<string, string> = {
  CA: "ca",
  US: "us",
  GB: "gb",
  SG: "sg",
  MY: "my",
  AU: "au",
  NZ: "nz",
  IN: "in",
  PK: "pk",
  AE: "ae",
  SA: "sa",
  QA: "qa",
  BH: "bh",
  OM: "om",
  KW: "kw",
  JO: "jo",
  EG: "eg",
  ZA: "za",
  NG: "ng",
  KE: "ke",
  ID: "id",
  PH: "ph",
  TH: "th",
  VN: "vn",
  CN: "cn",
  HK: "hk",
  MO: "mo",
  TW: "tw",
  JP: "jp",
  KR: "kr",
  FR: "fr",
  DE: "de",
  IT: "it",
  ES: "es",
  NL: "nl",
  BE: "be",
  CH: "ch",
  AT: "at",
  DK: "dk",
  SE: "se",
  NO: "no",
  IE: "ie",
  PT: "pt",
  GR: "gr",
  PL: "pl",
  TR: "tr",
  IL: "il",
  BD: "bd",
  LK: "lk",
};

export function readStoredPhoneCountryId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(PHONE_COUNTRY_PREF_STORAGE_KEY)?.trim();
    if (!v) return null;
    return getPhoneCountryEntryById(v) ? v : null;
  } catch {
    return null;
  }
}

export function writeStoredPhoneCountryId(id: string): void {
  if (typeof window === "undefined") return;
  if (!getPhoneCountryEntryById(id)) return;
  try {
    window.localStorage.setItem(PHONE_COUNTRY_PREF_STORAGE_KEY, id);
  } catch {
    /* quota / private mode */
  }
}

/**
 * Map BCP 47 language tag (e.g. `en-CA`, `en-GB`) to a picker id.
 * Unknown / unsupported region → Canada (`ca`).
 */
export function localeToCountryId(language: string | undefined): string {
  const raw = (language ?? "").trim();
  if (!raw) return "ca";

  let region: string | undefined;
  try {
    const Loc = Intl.Locale;
    if (typeof Loc === "function") {
      const loc = new Loc(raw);
      region = loc.region?.toUpperCase();
    }
  } catch {
    /* ignore */
  }

  if (!region) {
    const parts = raw.split("-");
    if (parts.length >= 2) {
      const last = parts[parts.length - 1].toUpperCase();
      if (last.length === 2) region = last;
    }
  }

  if (!region || region.length !== 2) return "ca";

  const id = REGION_TO_COUNTRY_ID[region];
  if (id && getPhoneCountryEntryById(id)) return id;

  return "ca";
}

/** For +1 NANP paste: prefer stored US/CA, else locale if US/CA, else Canada. */
export function countryIdForNanpPaste(): string {
  const stored = readStoredPhoneCountryId();
  if (stored === "us" || stored === "ca") return stored;
  if (typeof navigator === "undefined") return "ca";
  const loc = localeToCountryId(navigator.language);
  if (loc === "us" || loc === "ca") return loc;
  return "ca";
}
