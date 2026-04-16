import { describe, expect, it } from "vitest";
import { parseCsvPhoneRow } from "@/lib/phone";

describe("parseCsvPhoneRow CSV import", () => {
  it("parses explicit +44 in phone cell as UK", () => {
    const r = parseCsvPhoneRow("+44 7415 980802", undefined);
    expect(r.phoneCountryCode).toBe("+44");
    expect(r.phone).toBe("7415980802");
    expect(r.whatsappDigits).toBe("447415980802");
    expect(r.countryLabel).toContain("United Kingdom");
    expect(r.validWhatsApp).toBe(true);
  });

  it("lets +44 in phone win over a conflicting phoneCountryCode column (+1)", () => {
    const r = parseCsvPhoneRow("+44 7415 980802", "+1");
    expect(r.phoneCountryCode).toBe("+44");
    expect(r.whatsappDigits).toBe("447415980802");
    expect(r.validWhatsApp).toBe(true);
  });

  it("uses phoneCountryCode when phone has no + prefix", () => {
    const r = parseCsvPhoneRow("6478607861", "+1");
    expect(r.phoneCountryCode).toBe("+1");
    expect(r.whatsappDigits).toBe("16478607861");
  });
});
