/**
 * Lightweight metadata for the admin phone country picker (flags + search).
 * Dial codes align with `PHONE_COUNTRY_OPTIONS` in `lib/phone.ts`; +1 is split into CA/US for UX only.
 */

export type PhoneCountryEntry = {
  id: string;
  iso2: string;
  dialCode: string;
  name: string;
  /** Extra tokens for search (e.g. "uk", "usa"). */
  searchAliases: string[];
};

function flagEmoji(iso2: string): string {
  const upper = iso2.toUpperCase();
  if (upper.length !== 2) return "🌐";
  const A = 0x1f1e6;
  const a = upper.charCodeAt(0) - 65 + A;
  const b = upper.charCodeAt(1) - 65 + A;
  return String.fromCodePoint(a, b);
}

export function phoneCountryFlag(iso2: string): string {
  return flagEmoji(iso2);
}

/** Stable list used by the combobox (order is applied at render). */
export const PHONE_COUNTRY_ENTRIES: PhoneCountryEntry[] = [
  { id: "ca", iso2: "CA", dialCode: "+1", name: "Canada", searchAliases: ["can"] },
  { id: "us", iso2: "US", dialCode: "+1", name: "United States", searchAliases: ["usa", "america"] },
  { id: "gb", iso2: "GB", dialCode: "+44", name: "United Kingdom", searchAliases: ["uk", "britain", "england", "scotland", "wales"] },
  { id: "sg", iso2: "SG", dialCode: "+65", name: "Singapore", searchAliases: [] },
  { id: "my", iso2: "MY", dialCode: "+60", name: "Malaysia", searchAliases: [] },
  { id: "au", iso2: "AU", dialCode: "+61", name: "Australia", searchAliases: [] },
  { id: "nz", iso2: "NZ", dialCode: "+64", name: "New Zealand", searchAliases: [] },
  { id: "in", iso2: "IN", dialCode: "+91", name: "India", searchAliases: [] },
  { id: "pk", iso2: "PK", dialCode: "+92", name: "Pakistan", searchAliases: [] },
  { id: "ae", iso2: "AE", dialCode: "+971", name: "United Arab Emirates", searchAliases: ["uae", "emirates"] },
  { id: "sa", iso2: "SA", dialCode: "+966", name: "Saudi Arabia", searchAliases: [] },
  { id: "qa", iso2: "QA", dialCode: "+974", name: "Qatar", searchAliases: [] },
  { id: "bh", iso2: "BH", dialCode: "+973", name: "Bahrain", searchAliases: [] },
  { id: "om", iso2: "OM", dialCode: "+968", name: "Oman", searchAliases: [] },
  { id: "kw", iso2: "KW", dialCode: "+965", name: "Kuwait", searchAliases: [] },
  { id: "jo", iso2: "JO", dialCode: "+962", name: "Jordan", searchAliases: [] },
  { id: "eg", iso2: "EG", dialCode: "+20", name: "Egypt", searchAliases: [] },
  { id: "za", iso2: "ZA", dialCode: "+27", name: "South Africa", searchAliases: [] },
  { id: "ng", iso2: "NG", dialCode: "+234", name: "Nigeria", searchAliases: [] },
  { id: "ke", iso2: "KE", dialCode: "+254", name: "Kenya", searchAliases: [] },
  { id: "id", iso2: "ID", dialCode: "+62", name: "Indonesia", searchAliases: [] },
  { id: "ph", iso2: "PH", dialCode: "+63", name: "Philippines", searchAliases: [] },
  { id: "th", iso2: "TH", dialCode: "+66", name: "Thailand", searchAliases: [] },
  { id: "vn", iso2: "VN", dialCode: "+84", name: "Vietnam", searchAliases: [] },
  { id: "cn", iso2: "CN", dialCode: "+86", name: "China", searchAliases: [] },
  { id: "hk", iso2: "HK", dialCode: "+852", name: "Hong Kong", searchAliases: [] },
  { id: "mo", iso2: "MO", dialCode: "+853", name: "Macau", searchAliases: ["macao"] },
  { id: "tw", iso2: "TW", dialCode: "+886", name: "Taiwan", searchAliases: [] },
  { id: "jp", iso2: "JP", dialCode: "+81", name: "Japan", searchAliases: [] },
  { id: "kr", iso2: "KR", dialCode: "+82", name: "South Korea", searchAliases: ["korea"] },
  { id: "fr", iso2: "FR", dialCode: "+33", name: "France", searchAliases: [] },
  { id: "de", iso2: "DE", dialCode: "+49", name: "Germany", searchAliases: [] },
  { id: "it", iso2: "IT", dialCode: "+39", name: "Italy", searchAliases: [] },
  { id: "es", iso2: "ES", dialCode: "+34", name: "Spain", searchAliases: [] },
  { id: "nl", iso2: "NL", dialCode: "+31", name: "Netherlands", searchAliases: ["holland"] },
  { id: "be", iso2: "BE", dialCode: "+32", name: "Belgium", searchAliases: [] },
  { id: "ch", iso2: "CH", dialCode: "+41", name: "Switzerland", searchAliases: [] },
  { id: "at", iso2: "AT", dialCode: "+43", name: "Austria", searchAliases: [] },
  { id: "dk", iso2: "DK", dialCode: "+45", name: "Denmark", searchAliases: [] },
  { id: "se", iso2: "SE", dialCode: "+46", name: "Sweden", searchAliases: [] },
  { id: "no", iso2: "NO", dialCode: "+47", name: "Norway", searchAliases: [] },
  { id: "ie", iso2: "IE", dialCode: "+353", name: "Ireland", searchAliases: [] },
  { id: "pt", iso2: "PT", dialCode: "+351", name: "Portugal", searchAliases: [] },
  { id: "gr", iso2: "GR", dialCode: "+30", name: "Greece", searchAliases: [] },
  { id: "pl", iso2: "PL", dialCode: "+48", name: "Poland", searchAliases: [] },
  { id: "tr", iso2: "TR", dialCode: "+90", name: "Turkey", searchAliases: [] },
  { id: "il", iso2: "IL", dialCode: "+972", name: "Israel", searchAliases: [] },
  { id: "bd", iso2: "BD", dialCode: "+880", name: "Bangladesh", searchAliases: [] },
  { id: "lk", iso2: "LK", dialCode: "+94", name: "Sri Lanka", searchAliases: [] },
];

const BY_ID = new Map(PHONE_COUNTRY_ENTRIES.map((e) => [e.id, e]));
const BY_DIAL = new Map<string, PhoneCountryEntry[]>();
for (const e of PHONE_COUNTRY_ENTRIES) {
  const list = BY_DIAL.get(e.dialCode) ?? [];
  list.push(e);
  BY_DIAL.set(e.dialCode, list);
}

const PRIORITY_ORDER = ["ca", "us"];

/** Canada & US first, then alphabetical by country name. */
export function sortedPhoneCountryEntries(): PhoneCountryEntry[] {
  return [...PHONE_COUNTRY_ENTRIES].sort((a, b) => {
    const pa = PRIORITY_ORDER.indexOf(a.id);
    const pb = PRIORITY_ORDER.indexOf(b.id);
    if (pa >= 0 && pb >= 0) return pa - pb;
    if (pa >= 0) return -1;
    if (pb >= 0) return 1;
    return a.name.localeCompare(b.name);
  });
}

export function getPhoneCountryEntryById(id: string): PhoneCountryEntry | undefined {
  return BY_ID.get(id);
}

/** Default UI row for a stored dial code (e.g. +1 → Canada). */
export function defaultEntryIdForDialCode(dialCode: string): string {
  const d = dialCode.trim().startsWith("+") ? dialCode.trim() : `+${dialCode.replace(/^\+/, "").trim()}`;
  if (d === "+1") return "ca";
  const first = BY_DIAL.get(d)?.[0];
  return first?.id ?? "ca";
}

export function entryMatchesQuery(entry: PhoneCountryEntry, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const dialDigits = entry.dialCode.replace(/\D/g, "");
  const qDigits = q.replace(/\D/g, "");
  if (entry.name.toLowerCase().includes(q)) return true;
  if (entry.iso2.toLowerCase().includes(q)) return true;
  if (entry.dialCode.includes(q)) return true;
  if (qDigits && dialDigits.startsWith(qDigits)) return true;
  for (const a of entry.searchAliases) {
    if (a.includes(q) || q.includes(a)) return true;
  }
  return false;
}
