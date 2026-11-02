import { describe, expect, it } from "vitest";
import { itemFigures, summarizeBudget, type BudgetItemInput } from "@/lib/budget";
import { formatMinor, minorToInput, parseMoneyToMinor } from "@/lib/money";

describe("money", () => {
  it("parses amounts into integer minor units without float drift", () => {
    expect(parseMoneyToMinor("0.10", "USD")).toBe(10);
    expect(parseMoneyToMinor("1,250.5", "USD")).toBe(125050);
    expect(parseMoneyToMinor("$3,000", "USD")).toBe(300000);
    expect(parseMoneyToMinor("19.99", "USD")! * 3).toBe(5997);
    expect(parseMoneyToMinor("1500", "JPY")).toBe(1500);
  });
  it("rejects ambiguous or invalid input", () => {
    expect(parseMoneyToMinor("1.234", "USD")).toBeNull();
    expect(parseMoneyToMinor("12,34", "USD")).toBeNull();
    expect(parseMoneyToMinor("-5", "USD")).toBeNull();
    expect(parseMoneyToMinor("", "USD")).toBeNull();
    expect(parseMoneyToMinor("1.5", "JPY")).toBeNull();
  });
  it("formats and round-trips", () => {
    expect(formatMinor(125050, "USD")).toBe("$1,250.50");
    expect(formatMinor(250000, "INR")).toBe("₹2,500.00");
    expect(minorToInput(125050, "USD")).toBe("1250.50");
  });
});

const item = (p: Partial<BudgetItemInput> & { id: string }): BudgetItemInput => ({
  eventId: null,
  estimateMinor: 0,
  agreedMinor: null,
  perPersonMinor: null,
  perPersonBasis: null,
  payments: [],
  ...p,
});

describe("budget", () => {
  const headcounts = new Map([
    ["mehndi", { invited: 120, confirmed: 90 }],
    ["reception", { invited: 300, confirmed: 250 }],
  ]);

  it("uses agreed price, then per-person × the linked event's attendance, then the estimate", () => {
    expect(itemFigures(item({ id: "a", estimateMinor: 500000, agreedMinor: 450000 }), headcounts)).toMatchObject({ plannedMinor: 450000, source: "agreed" });
    expect(itemFigures(item({ id: "b", eventId: "mehndi", perPersonMinor: 4500, perPersonBasis: "invited" }), headcounts)).toMatchObject({
      plannedMinor: 540000,
      perPersonCount: 120,
      source: "per_person",
    });
    expect(itemFigures(item({ id: "c", eventId: "reception", perPersonMinor: 6000, perPersonBasis: "confirmed" }), headcounts).plannedMinor).toBe(1500000);
    expect(itemFigures(item({ id: "d", estimateMinor: 120000 }), headcounts)).toMatchObject({ plannedMinor: 120000, source: "estimate", balanceMinor: null });
  });

  it("totals wedding-wide and per-event lines exactly once, and separates balances from estimates", () => {
    const s = summarizeBudget(
      [
        item({ id: "venue", eventId: "reception", agreedMinor: 1000000, payments: [{ amountMinor: 250000 }, { amountMinor: 250000 }] }),
        item({ id: "catering", eventId: "mehndi", perPersonMinor: 4500, perPersonBasis: "invited" }),
        item({ id: "photo", eventId: null, agreedMinor: 400000, payments: [{ amountMinor: 100000 }] }),
      ],
      headcounts,
    );
    expect(s.total).toEqual({
      plannedMinor: 1000000 + 540000 + 400000,
      agreedMinor: 1400000,
      paidMinor: 600000,
      balanceDueMinor: 500000 + 300000,
      stillEstimatedMinor: 540000,
      itemCount: 3,
    });
    expect(s.byEvent.get("reception")!.plannedMinor).toBe(1000000);
    expect(s.byEvent.get(null)!.plannedMinor).toBe(400000);
    const perEventSum = [...s.byEvent.values()].reduce((sum, t) => sum + t.plannedMinor, 0);
    expect(perEventSum).toBe(s.total.plannedMinor);
  });

  it("never reports a negative balance when overpaid", () => {
    expect(itemFigures(item({ id: "x", agreedMinor: 1000, payments: [{ amountMinor: 1500 }] }), headcounts)).toMatchObject({ balanceMinor: 0, overpaidMinor: 500 });
  });
});
