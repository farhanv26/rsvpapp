import { describe, expect, it } from "vitest";
import { localeToCountryId } from "@/lib/phone-country-preference";

describe("localeToCountryId", () => {
  it("maps en-CA to Canada", () => {
    expect(localeToCountryId("en-CA")).toBe("ca");
  });

  it("maps en-US to United States", () => {
    expect(localeToCountryId("en-US")).toBe("us");
  });

  it("maps en-GB to United Kingdom", () => {
    expect(localeToCountryId("en-GB")).toBe("gb");
  });

  it("falls back to Canada for unknown region", () => {
    expect(localeToCountryId("")).toBe("ca");
    expect(localeToCountryId("zz-ZZ")).toBe("ca");
  });
});
