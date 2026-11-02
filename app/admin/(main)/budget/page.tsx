import { deleteBudgetItemAction, deletePaymentAction, recordPaymentAction, saveBudgetItemAction } from "@/app/admin/planning/actions";
import { EmptyState, Feedback, NoWeddingSelected, PageHeader, Stat, StatStrip } from "@/components/admin/planning-ui";
import { ConfirmSubmit, DialogTrigger } from "@/components/admin/ui/dialog-trigger";
import { Plus } from "lucide-react";
import { summarizeEventAttendance } from "@/lib/attendance";
import { summarizeBudget, type EventHeadcount, type ItemFigures } from "@/lib/budget";
import { formatMinor, minorToInput } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { loadPlanningPage } from "@/lib/workspace-page";

export const dynamic = "force-dynamic";

const CATEGORIES = ["Venue", "Catering", "Decor & flowers", "Photography & video", "Attire & jewellery", "Mehndi & beauty", "Music & entertainment", "Stationery", "Transport", "Favours & gifts", "Other"];

type Props = { searchParams?: Promise<{ saved?: string; error?: string }> };

function dueLabel(due: Date | null, balance: number | null): { text: string; tone: string } | null {
  if (!due) return null;
  const today = new Date();
  const days = Math.round((Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
  const date = new Intl.DateTimeFormat("en", { weekday: days >= 0 && days < 7 ? "long" : undefined, month: "short", day: "numeric", timeZone: "UTC" }).format(due);
  if (balance === 0) return { text: `Was due ${date}`, tone: "text-[var(--muted-text)]" };
  if (days < 0) return { text: `Overdue since ${date}`, tone: "status status-danger font-medium text-[var(--danger)]" };
  if (days === 0) return { text: "Due today", tone: "status status-warning font-medium" };
  return { text: `Due ${date}`, tone: days < 14 ? "status status-warning" : "status status-muted" };
}

function plannedLabel(f: ItemFigures, perPersonMinor: number | null, basis: string | null, currency: string) {
  if (f.source === "agreed") return "Agreed";
  if (f.source === "per_person" && perPersonMinor !== null) {
    return `Estimate · ${formatMinor(perPersonMinor, currency)} × ${f.perPersonCount} ${basis === "confirmed" ? "confirmed" : "invited"}`;
  }
  return "Estimate";
}

export default async function BudgetPage({ searchParams }: Props) {
  const sp = searchParams ? await searchParams : {};
  const { workspace, wedding } = await loadPlanningPage();
  if (!wedding) {
    return (
      <main className="app-shell">
        <PageHeader title="Budget" />
        <NoWeddingSelected hasWeddings={workspace.weddings.length > 0} />
      </main>
    );
  }
  const currency = wedding.currency;
  const [events, items, vendors] = await Promise.all([
    prisma.event.findMany({
      where: { weddingId: wedding.id, deletedAt: null },
      orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        guests: {
          where: { deletedAt: null },
          select: {
            menCount: true, womenCount: true, kidsCount: true, maxGuests: true, excludeFromTotals: true, excludeReason: true,
            excludedGuestCount: true, excludedMenCount: true, excludedWomenCount: true, excludedKidsCount: true,
            attending: true, attendingCount: true, respondedAt: true, invitedAt: true,
          },
        },
      },
    }),
    prisma.budgetItem.findMany({
      where: { weddingId: wedding.id, deletedAt: null },
      orderBy: [{ nextPaymentDueAt: "asc" }, { createdAt: "asc" }],
      include: { payments: { orderBy: { paidAt: "asc" } }, vendor: { select: { name: true } } },
    }),
    prisma.vendor.findMany({ where: { weddingId: wedding.id, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const headcounts = new Map<string, EventHeadcount>(
    events.map((e) => {
      const a = summarizeEventAttendance(e.guests);
      return [e.id, { invited: a.invitedPeople, confirmed: a.confirmedPeople }];
    }),
  );
  const summary = summarizeBudget(items, headcounts);
  const groups: { key: string | null; title: string }[] = [
    { key: null, title: "Shared costs (whole wedding)" },
    ...events.map((e) => ({ key: e.id, title: e.title })),
  ];
  const money = (m: number) => formatMinor(m, currency);

  const itemForm = (item?: (typeof items)[number]) => (
    <form action={saveBudgetItemAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="weddingId" value={wedding.id} />
      {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
      <label className="form-label sm:col-span-2">
        Expense
        <input name="label" required maxLength={120} defaultValue={item?.label} placeholder="Reception venue" className="input-luxe" />
      </label>
      <label className="form-label">
        Category
        <select name="category" defaultValue={item?.category ?? "Venue"} className="input-luxe">
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="form-label">
        For
        <select name="eventId" defaultValue={item?.eventId ?? ""} className="input-luxe">
          <option value="">Whole wedding</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
      </label>
      <label className="form-label">
        Estimate ({currency})
        <input name="estimate" inputMode="decimal" defaultValue={minorToInput(item?.estimateMinor ?? null, currency)} placeholder="0" className="input-luxe" />
      </label>
      <label className="form-label">
        Agreed price <span className="font-normal text-[var(--muted-text)]">(once contracted)</span>
        <input name="agreed" inputMode="decimal" defaultValue={minorToInput(item?.agreedMinor ?? null, currency)} className="input-luxe" />
      </label>
      <label className="form-label">
        Per-person estimate <span className="font-normal text-[var(--muted-text)]">(optional)</span>
        <input name="perPerson" inputMode="decimal" defaultValue={minorToInput(item?.perPersonMinor ?? null, currency)} className="input-luxe" />
      </label>
      <label className="form-label">
        Multiply by
        <select name="perPersonBasis" defaultValue={item?.perPersonBasis ?? "invited"} className="input-luxe">
          <option value="invited">People invited to the event</option>
          <option value="confirmed">People confirmed</option>
        </select>
      </label>
      <label className="form-label">
        Vendor
        <select name="vendorId" defaultValue={item?.vendorId ?? ""} className="input-luxe">
          <option value="">None</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </label>
      <label className="form-label">
        Next payment due
        <input name="nextPaymentDueAt" type="date" defaultValue={item?.nextPaymentDueAt?.toISOString().slice(0, 10)} className="input-luxe" />
      </label>
      <label className="form-label sm:col-span-2">
        Notes
        <input name="notes" maxLength={1000} defaultValue={item?.notes ?? ""} className="input-luxe" />
      </label>
      <p className="text-xs text-[var(--muted-text)] sm:col-span-2">A per-person estimate multiplies by the event&apos;s current headcount and updates as guests reply.</p>
      <div className="flex justify-end sm:col-span-2">
        <button type="submit" className="btn-primary">{item ? "Save changes" : "Add expense"}</button>
      </div>
    </form>
  );

  const paymentPanel = (item: (typeof items)[number]) => (
    <div className="space-y-4">
      <form action={recordPaymentAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="weddingId" value={wedding.id} />
        <input type="hidden" name="itemId" value={item.id} />
        <label className="form-label">
          Amount ({currency})
          <input name="amount" inputMode="decimal" required className="input-luxe" />
        </label>
        <label className="form-label">
          Paid on
          <input name="paidAt" type="date" className="input-luxe" />
        </label>
        <button type="submit" className="btn-primary">
          Record payment
        </button>
      </form>
      {item.payments.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-[var(--muted-text)]">Payments so far</p>
          <ul className="list-rows mt-1.5 text-sm">
            {item.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="tabular-nums">
                  {money(p.amountMinor)}
                  <span className="text-[var(--muted-text)]"> · {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(p.paidAt)}</span>
                  {p.note ? <span className="text-[var(--muted-text)]"> · {p.note}</span> : null}
                </span>
                <form action={deletePaymentAction}>
                  <input type="hidden" name="weddingId" value={wedding.id} />
                  <input type="hidden" name="paymentId" value={p.id} />
                  <ConfirmSubmit message={`Remove the payment of ${money(p.amountMinor)}?`} className="btn-ghost btn-sm text-[var(--danger)]">
                    Remove
                  </ConfirmSubmit>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );

  const editPanel = (item: (typeof items)[number]) => (
    <div className="space-y-5">
      {itemForm(item)}
      <form action={deleteBudgetItemAction} className="border-t border-[var(--border-soft)] pt-4">
        <input type="hidden" name="weddingId" value={wedding.id} />
        <input type="hidden" name="itemId" value={item.id} />
        <ConfirmSubmit message={`Remove "${item.label}" and its payments from the budget?`} className="btn-danger-quiet">
          Remove expense
        </ConfirmSubmit>
      </form>
    </div>
  );

  return (
    <main className="app-shell">
      <PageHeader
        title="Budget"
        meta={`Amounts in ${currency}`}
        actions={
          <DialogTrigger
            title="Add expense"
            triggerClassName="btn-primary"
            label={
              <>
                <Plus className="h-4 w-4" aria-hidden />
                Add expense
              </>
            }
          >
            {itemForm()}
          </DialogTrigger>
        }
      />
      <Feedback saved={sp.saved} error={sp.error} />

      <StatStrip columns={4}>
        <Stat label="Planned" value={money(summary.total.plannedMinor)} hint={`${summary.total.itemCount} ${summary.total.itemCount === 1 ? "line" : "lines"}`} />
        <Stat label="Paid" value={money(summary.total.paidMinor)} hint={`of ${money(summary.total.agreedMinor)} agreed`} />
        <Stat label="Balance due" value={money(summary.total.balanceDueMinor)} hint="on agreed prices" />
        <Stat label="Not yet agreed" value={money(summary.total.stillEstimatedMinor)} hint="estimates" />
      </StatStrip>

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No expenses yet">Add your first expense, or add a vendor and send their quote to the budget.</EmptyState>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {groups.map((group) => {
            const rows = items.filter((i) => i.eventId === group.key);
            if (rows.length === 0) return null;
            const t = summary.byEvent.get(group.key)!;
            return (
              <section key={group.key ?? "shared"} aria-labelledby={`budget-${group.key ?? "shared"}`}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                  <h2 id={`budget-${group.key ?? "shared"}`} className="section-heading">
                    {group.key ? group.title : "Whole wedding"}
                  </h2>
                  <p className="text-sm tabular-nums text-[var(--muted-text)]">
                    {money(t.plannedMinor)} planned · {money(t.paidMinor)} paid
                    {t.balanceDueMinor > 0 ? ` · ${money(t.balanceDueMinor)} due` : ""}
                  </p>
                </div>

                {/* Phone rows */}
                <ul className="list-rows md:hidden">
                  {rows.map((item) => {
                    const f = summary.figures.get(item.id)!;
                    const due = dueLabel(item.nextPaymentDueAt, f.balanceMinor);
                    return (
                      <li key={item.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium break-words">{item.label}</p>
                            <p className="text-xs text-[var(--muted-text)]">
                              {[item.category, item.vendor?.name].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-medium tabular-nums">{money(f.plannedMinor)}</p>
                            <p className="text-xs text-[var(--muted-text)]">{f.source === "agreed" ? "Agreed" : "Estimate"}</p>
                          </div>
                        </div>
                        <p className="mt-1.5 text-sm tabular-nums">
                          {money(f.paidMinor)} paid
                          <span className="text-[var(--muted-text)]">
                            {f.balanceMinor === null ? " · price not agreed" : f.balanceMinor > 0 ? ` · ${money(f.balanceMinor)} left` : " · paid in full"}
                          </span>
                          {f.overpaidMinor > 0 ? <span className="text-[var(--danger)]"> · overpaid {money(f.overpaidMinor)}</span> : null}
                        </p>
                        {due ? <p className={`mt-0.5 text-sm ${due.tone}`}>{due.text}</p> : null}
                        <div className="mt-2 flex gap-2">
                          <DialogTrigger title="Record payment" description={item.label} label="Payment" triggerClassName="btn-secondary btn-sm">
                            {paymentPanel(item)}
                          </DialogTrigger>
                          <DialogTrigger title={`Edit ${item.label}`} label="Edit" triggerClassName="btn-ghost btn-sm">
                            {editPanel(item)}
                          </DialogTrigger>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {/* Desktop table */}
                <div className="app-card hidden md:block">
                  <table className="data-table table-fixed">
                    <colgroup>
                      <col />
                      <col className="w-36" />
                      <col className="w-28" />
                      <col className="w-32" />
                      <col className="w-44" />
                      <col className="w-40" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th scope="col">Expense</th>
                        <th scope="col" className="text-right">
                          Planned
                        </th>
                        <th scope="col" className="text-right">
                          Paid
                        </th>
                        <th scope="col" className="text-right">
                          Balance
                        </th>
                        <th scope="col">Next payment</th>
                        <th scope="col">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((item) => {
                        const f = summary.figures.get(item.id)!;
                        const due = dueLabel(item.nextPaymentDueAt, f.balanceMinor);
                        return (
                          <tr key={item.id}>
                            <td>
                              <p className="font-medium break-words">{item.label}</p>
                              <p className="text-xs break-words text-[var(--muted-text)]">{[item.category, item.vendor?.name].filter(Boolean).join(" · ")}</p>
                            </td>
                            <td className="text-right tabular-nums">
                              {money(f.plannedMinor)}
                              <p className="text-xs text-[var(--muted-text)]">{plannedLabel(f, item.perPersonMinor, item.perPersonBasis, currency)}</p>
                            </td>
                            <td className="text-right tabular-nums">{money(f.paidMinor)}</td>
                            <td className="text-right tabular-nums">
                              {f.balanceMinor === null ? <span className="text-[var(--muted-text)]">Not agreed</span> : money(f.balanceMinor)}
                              {f.overpaidMinor > 0 ? <p className="text-xs text-[var(--danger)]">Overpaid {money(f.overpaidMinor)}</p> : null}
                            </td>
                            <td>{due ? <span className={due.tone}>{due.text}</span> : <span className="text-[var(--muted-text)]">—</span>}</td>
                            <td className="text-right whitespace-nowrap">
                              <DialogTrigger title="Record payment" description={item.label} label="Payment" triggerClassName="btn-ghost btn-sm" triggerAriaLabel={`Record payment for ${item.label}`}>
                                {paymentPanel(item)}
                              </DialogTrigger>
                              <DialogTrigger title={`Edit ${item.label}`} label="Edit" triggerClassName="btn-ghost btn-sm" triggerAriaLabel={`Edit ${item.label}`}>
                                {editPanel(item)}
                              </DialogTrigger>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
