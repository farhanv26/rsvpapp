import { describe, expect, it } from "vitest";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp";

describe("normalizePhoneForWhatsApp", () => {
  it("Case A: + prefix keeps international digits", () => {
    expect(normalizePhoneForWhatsApp("+44 7860 123456")).toBe("447860123456");
    expect(normalizePhoneForWhatsApp("+1 647-860-7861")).toBe("16478607861");
    expect(normalizePhoneForWhatsApp("+65 9123 4567")).toBe("6591234567");
  });

  it("Case B: NANP 10-digit prepends 1", () => {
    expect(normalizePhoneForWhatsApp("6478607861")).toBe("16478607861");
    expect(normalizePhoneForWhatsApp("(647) 860-7861")).toBe("16478607861");
  });

  it("Case B: NANP 11-digit starting with 1 is kept", () => {
    expect(normalizePhoneForWhatsApp("16478607861")).toBe("16478607861");
  });

  it("Case C: UK local 07… → 44…", () => {
    expect(normalizePhoneForWhatsApp("07860123456")).toBe("447860123456");
    expect(normalizePhoneForWhatsApp("07911 123456")).toBe("447911123456");
  });

  it("Case D: long international without +", () => {
    expect(normalizePhoneForWhatsApp("447860123456")).toBe("447860123456");
  });

  it("00 prefix without +", () => {
    expect(normalizePhoneForWhatsApp("0044 7860 123456")).toBe("447860123456");
  });

  it("rejects ambiguous leading 0 outside UK length", () => {
    expect(normalizePhoneForWhatsApp("012345678")).toBeNull();
  });

  it("empty or null", () => {
    expect(normalizePhoneForWhatsApp("")).toBeNull();
    expect(normalizePhoneForWhatsApp(null)).toBeNull();
  });
});
