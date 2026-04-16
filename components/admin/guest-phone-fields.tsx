"use client";

import { useLayoutEffect, useState } from "react";
import { PhoneCountryCombobox } from "@/components/admin/phone-country-combobox";
import {
  localeToCountryId,
  readStoredPhoneCountryId,
  writeStoredPhoneCountryId,
  countryIdForNanpPaste,
} from "@/lib/phone-country-preference";
import { defaultEntryIdForDialCode, getPhoneCountryEntryById } from "@/lib/phone-country-data";
import {
  DEFAULT_PHONE_COUNTRY,
  formatNationalDigitsDisplay,
  normalizePhoneForWhatsApp,
  normalizePhoneForWhatsAppGuestRecord,
  sanitizeNationalDigitsInput,
  splitE164DigitsToGuestFields,
  WHATSAPP_PHONE_HELPER_TEXT,
  WHATSAPP_PHONE_INVALID_INLINE,
} from "@/lib/phone";

type Props = {
  nameCountry?: string;
  nameNational?: string;
  defaultCountryCode: string | null;
  defaultNationalDigits: string;
  legacyPhone: string | null;
  showWhatsAppPreview?: boolean;
  /** `page` matches `input-luxe` (add-guest dashboard); `modal` matches compact admin inputs */
  variant?: "modal" | "page";
  className?: string;
};

function deriveInitial(
  legacyPhone: string | null,
  country: string | null,
  national: string,
): { countryId: string; national: string } {
  if (country?.trim()) {
    const dial = country.trim();
    const nat = national.trim();
    return {
      countryId: defaultEntryIdForDialCode(dial),
      national: nat ? sanitizeNationalDigitsInput(dial, nat) : "",
    };
  }
  if (legacyPhone?.trim()) {
    const w = normalizePhoneForWhatsApp(legacyPhone);
    const split = w ? splitE164DigitsToGuestFields(w) : null;
    if (split) {
      return {
        countryId: defaultEntryIdForDialCode(split.phoneCountryCode),
        national: sanitizeNationalDigitsInput(split.phoneCountryCode, split.national),
      };
    }
  }
  return { countryId: defaultEntryIdForDialCode(DEFAULT_PHONE_COUNTRY), national: "" };
}

function countryIdFromParsedSplit(phoneCountryCode: string): string {
  const dial = phoneCountryCode.trim();
  if (dial === "+1") return countryIdForNanpPaste();
  return defaultEntryIdForDialCode(dial);
}

export function GuestPhoneFields({
  nameCountry = "phoneCountryCode",
  nameNational = "phone",
  defaultCountryCode,
  defaultNationalDigits,
  legacyPhone,
  showWhatsAppPreview = true,
  variant = "modal",
  className = "",
}: Props) {
  const [countryId, setCountryId] = useState(
    () => deriveInitial(legacyPhone, defaultCountryCode, defaultNationalDigits).countryId,
  );
  const [nationalDigits, setNationalDigits] = useState(
    () => deriveInitial(legacyPhone, defaultCountryCode, defaultNationalDigits).national,
  );

  const isBlankGuest =
    !defaultCountryCode?.trim() && !defaultNationalDigits?.trim() && !legacyPhone?.trim();

  /* Client-only: apply stored preference or navigator.language for new-guest forms.
     SSR/first paint use Canada-first `deriveInitial`; this runs before paint to avoid visible flash. */
  /* eslint-disable react-hooks/set-state-in-effect -- blank-guest locale bootstrap only; avoids SSR hydration mismatch */
  useLayoutEffect(() => {
    if (!isBlankGuest) return;
    const stored = readStoredPhoneCountryId();
    if (stored) {
      setCountryId(stored);
      return;
    }
    if (typeof navigator !== "undefined") {
      setCountryId(localeToCountryId(navigator.language));
    }
  }, [isBlankGuest]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const resolvedCountryId = getPhoneCountryEntryById(countryId)?.id ?? defaultEntryIdForDialCode(defaultCountryCode ?? DEFAULT_PHONE_COUNTRY);
  const resolvedDial =
    getPhoneCountryEntryById(resolvedCountryId)?.dialCode ??
    (defaultCountryCode?.trim() || DEFAULT_PHONE_COUNTRY);

  const display = formatNationalDigitsDisplay(resolvedDial, nationalDigits);

  const waDigits = normalizePhoneForWhatsAppGuestRecord({
    phone: nationalDigits,
    phoneCountryCode: resolvedDial,
  });
  const invalid = nationalDigits.length > 0 && waDigits === null;

  function applyParsedInternational(fullE164Digits: string) {
    const split = splitE164DigitsToGuestFields(fullE164Digits);
    if (!split) return false;
    setCountryId(countryIdFromParsedSplit(split.phoneCountryCode));
    setNationalDigits(sanitizeNationalDigitsInput(split.phoneCountryCode, split.national));
    return true;
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text/plain").trim();
    if (!text) return;

    const normalized = normalizePhoneForWhatsApp(text);
    if (normalized && applyParsedInternational(normalized)) {
      e.preventDefault();
      return;
    }

    const digits = text.replace(/\D/g, "");
    if (digits.length >= 11 && digits.length <= 15 && !text.trim().startsWith("+")) {
      if (applyParsedInternational(digits)) {
        e.preventDefault();
      }
    }
  }

  const isPage = variant === "page";
  const shellRing = invalid
    ? "border-amber-300/90"
    : isPage
      ? "border-[#dccfbb] focus-within:border-[#b28944] focus-within:ring-2 focus-within:ring-[#b28944]/20"
      : "border-[#dccfbb] focus-within:border-[#c4a574] focus-within:ring-2 focus-within:ring-[#c4a574]/30";
  const shellRadius = isPage ? "rounded-2xl" : "rounded-xl";
  const telPad = isPage ? "px-4 py-3 text-base" : "px-3 py-2 text-sm";
  const telMinH = isPage ? "min-h-[52px]" : "min-h-[40px]";
  const combMinH = isPage ? "min-h-[52px]" : "min-h-[40px]";

  return (
    <div className={`min-w-0 ${className}`}>
      <label className="block text-sm font-medium text-zinc-700">
        Phone
        <span className="mt-0.5 block text-xs font-normal leading-snug text-zinc-500">{WHATSAPP_PHONE_HELPER_TEXT}</span>
        <span className="mt-1.5 block">
          <input type="hidden" name={nameCountry} value={resolvedDial} readOnly />
          <input type="hidden" name={nameNational} value={nationalDigits} readOnly />
          {/* overflow-visible so nothing clips the country trigger; dropdown renders in a portal */}
          <div
            className={`flex w-full flex-row items-stretch overflow-visible border bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition ${shellRadius} ${shellRing}`}
          >
            <div
              className={`flex shrink-0 items-stretch border-r border-[#e7dfd0] ${combMinH} ${isPage ? "sm:min-w-[10rem]" : "sm:min-w-[8.75rem]"}`}
            >
              <PhoneCountryCombobox
                valueId={resolvedCountryId}
                onChange={(id) => {
                  const entry = getPhoneCountryEntryById(id);
                  if (!entry) return;
                  setCountryId(id);
                  writeStoredPhoneCountryId(id);
                  setNationalDigits((prev) => sanitizeNationalDigitsInput(entry.dialCode, prev));
                }}
                compact
                className="flex h-full min-h-0 w-full min-w-0"
              />
            </div>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              value={display}
              onChange={(e) => {
                const next = sanitizeNationalDigitsInput(resolvedDial, e.target.value);
                setNationalDigits(next);
              }}
              onPaste={handlePaste}
              placeholder={
                resolvedDial === "+1" ? "(555) 555-5555" : resolvedDial === "+44" ? "7XXX XXXXXX" : "National number"
              }
              className={`min-w-0 flex-1 border-0 bg-transparent text-zinc-900 outline-none placeholder:text-zinc-400 ${telMinH} ${telPad}`}
              aria-label="Phone number"
            />
          </div>
        </span>
      </label>
      {invalid ? (
        <p className="mt-1.5 text-xs font-medium text-amber-900">{WHATSAPP_PHONE_INVALID_INLINE}</p>
      ) : null}
      {showWhatsAppPreview && waDigits ? (
        <p className="mt-1.5 font-mono text-xs text-zinc-600">
          WhatsApp: <span className="text-zinc-900">{waDigits}</span>
        </p>
      ) : null}
      {!defaultCountryCode && legacyPhone?.trim() && !nationalDigits.length ? (
        <p className="mt-2 text-xs text-zinc-500">
          Previous value: <span className="font-mono">{legacyPhone}</span> — edit above to save in the new format.
        </p>
      ) : null}
    </div>
  );
}
