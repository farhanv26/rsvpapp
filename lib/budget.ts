/**
 * Budget arithmetic (pure, integer minor units).
 * - Each item belongs to the whole wedding (eventId null) or exactly one event, so the wedding
 *   total is a single sum over items: nothing is counted twice.
 * - Planned amount: agreed price if set; else per-person × the event's attendance; else estimate.
 * - Balance due is only computed against agreed prices. Estimate-only items report "still estimated".
 */
export type BudgetItemInput = {
  id: string;
  eventId: string | null;
  estimateMinor: number;
  agreedMinor: number | null;
  perPersonMinor: number | null;
  perPersonBasis: string | null;
  payments: { amountMinor: number }[];
};

export type EventHeadcount = { invited: number; confirmed: number };

export type ItemFigures = {
  plannedMinor: number;
  source: "agreed" | "per_person" | "estimate";
  perPersonCount: number | null;
  paidMinor: number;
  balanceMinor: number | null;
  overpaidMinor: number;
};

export function itemFigures(item: BudgetItemInput, headcounts: Map<string, EventHeadcount>): ItemFigures {
  const paidMinor = item.payments.reduce((s, p) => s + p.amountMinor, 0);
  let plannedMinor = item.estimateMinor;
  let source: ItemFigures["source"] = "estimate";
  let perPersonCount: number | null = null;
  if (item.agreedMinor !== null) {
    plannedMinor = item.agreedMinor;
    source = "agreed";
  } else if (item.perPersonMinor !== null && item.eventId) {
    const hc = headcounts.get(item.eventId);
    perPersonCount = hc ? (item.perPersonBasis === "confirmed" ? hc.confirmed : hc.invited) : 0;
    plannedMinor = item.perPersonMinor * perPersonCount;
    source = "per_person";
  }
  const balanceMinor = item.agreedMinor !== null ? Math.max(item.agreedMinor - paidMinor, 0) : null;
  const overpaidMinor = item.agreedMinor !== null ? Math.max(paidMinor - item.agreedMinor, 0) : 0;
  return { plannedMinor, source, perPersonCount, paidMinor, balanceMinor, overpaidMinor };
}

export type BudgetTotals = {
  plannedMinor: number;
  agreedMinor: number;
  paidMinor: number;
  balanceDueMinor: number;
  stillEstimatedMinor: number;
  itemCount: number;
};

function emptyTotals(): BudgetTotals {
  return { plannedMinor: 0, agreedMinor: 0, paidMinor: 0, balanceDueMinor: 0, stillEstimatedMinor: 0, itemCount: 0 };
}

export function summarizeBudget(items: BudgetItemInput[], headcounts: Map<string, EventHeadcount>) {
  const total = emptyTotals();
  const byEvent = new Map<string | null, BudgetTotals>();
  const figures = new Map<string, ItemFigures>();
  for (const item of items) {
    const f = itemFigures(item, headcounts);
    figures.set(item.id, f);
    const bucket = byEvent.get(item.eventId) ?? emptyTotals();
    for (const t of [total, bucket]) {
      t.itemCount += 1;
      t.plannedMinor += f.plannedMinor;
      t.paidMinor += f.paidMinor;
      if (item.agreedMinor !== null) {
        t.agreedMinor += item.agreedMinor;
        t.balanceDueMinor += f.balanceMinor ?? 0;
      } else {
        t.stillEstimatedMinor += Math.max(f.plannedMinor - f.paidMinor, 0);
      }
    }
    byEvent.set(item.eventId, bucket);
  }
  return { total, byEvent, figures };
}
