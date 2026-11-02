import Link from "next/link";
import { addVendorToBudgetAction, deleteVendorAction, saveVendorAction } from "@/app/admin/planning/actions";
import { EmptyState, Feedback, NoWeddingSelected, PageHeader } from "@/components/admin/planning-ui";
import { ConfirmSubmit, DialogTrigger } from "@/components/admin/ui/dialog-trigger";
import { Plus } from "lucide-react";
import { formatMinor, minorToInput } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { loadPlanningPage } from "@/lib/workspace-page";

export const dynamic = "force-dynamic";

const STATUSES = [
  { value: "considering", label: "Considering" },
  { value: "quoted", label: "Quote received" },
  { value: "booked", label: "Booked" },
  { value: "declined", label: "Not going ahead" },
] as const;
const CATEGORIES = ["Venue", "Caterer", "Decorator", "Photographer", "Videographer", "Mehndi artist", "Hair & makeup", "DJ / band", "Officiant", "Florist", "Stationery", "Transport", "Other"];

type Props = { searchParams?: Promise<{ saved?: string; error?: string; status?: string }> };

export default async function VendorsPage({ searchParams }: Props) {
  const sp = searchParams ? await searchParams : {};
  const { workspace, wedding } = await loadPlanningPage();
  if (!wedding) {
    return (
      <main className="app-shell">
        <PageHeader title="Vendors" />
        <NoWeddingSelected hasWeddings={workspace.weddings.length > 0} />
      </main>
    );
  }
  const currency = wedding.currency;
  const statusFilter = STATUSES.some((s) => s.value === sp.status) ? sp.status : null;
  const vendors = await prisma.vendor.findMany({
    where: { weddingId: wedding.id, deletedAt: null, ...(statusFilter ? { status: statusFilter } : {}) },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      budgetItems: {
        where: { deletedAt: null },
        select: { id: true, agreedMinor: true, estimateMinor: true, nextPaymentDueAt: true, payments: { select: { amountMinor: true } } },
      },
    },
  });

  const vendorForm = (v?: (typeof vendors)[number]) => (
    <form action={saveVendorAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="weddingId" value={wedding.id} />
      {v ? <input type="hidden" name="vendorId" value={v.id} /> : null}
      <label className="form-label">
        Name
        <input name="name" required maxLength={120} defaultValue={v?.name} placeholder="Noor Events Catering" className="input-luxe" />
      </label>
      <label className="form-label">
        Service
        <select name="category" defaultValue={v?.category ?? "Caterer"} className="input-luxe">
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="form-label">
        Status
        <select name="status" defaultValue={v?.status ?? "considering"} className="input-luxe">
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </label>
      <label className="form-label">
        Contact person
        <input name="contactName" maxLength={120} defaultValue={v?.contactName ?? ""} className="input-luxe" />
      </label>
      <label className="form-label">
        Phone
        <input name="phone" type="tel" maxLength={40} defaultValue={v?.phone ?? ""} className="input-luxe" />
      </label>
      <label className="form-label">
        Email
        <input name="email" type="email" maxLength={160} defaultValue={v?.email ?? ""} className="input-luxe" />
      </label>
      <label className="form-label">
        Website
        <input name="website" type="url" maxLength={200} defaultValue={v?.website ?? ""} placeholder="https://" className="input-luxe" />
      </label>
      <label className="form-label">
        Quote ({currency})
        <input name="quote" inputMode="decimal" defaultValue={minorToInput(v?.quoteMinor ?? null, currency)} className="input-luxe" />
      </label>
      <label className="form-label sm:col-span-2">
        Private notes
        <textarea name="notes" maxLength={2000} rows={2} defaultValue={v?.notes ?? ""} className="input-luxe" />
        <span className="field-hint block font-normal">Only members of this wedding can see these.</span>
      </label>
      <div className="flex justify-end sm:col-span-2">
        <button type="submit" className="btn-primary">{v ? "Save vendor" : "Add vendor"}</button>
      </div>
    </form>
  );

  const due = (d: Date) => new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(d);
  const rows = vendors.map((v) => {
    const agreed = v.budgetItems.reduce((s, b) => s + (b.agreedMinor ?? 0), 0);
    const paid = v.budgetItems.reduce((s, b) => s + b.payments.reduce((x, p) => x + p.amountMinor, 0), 0);
    const nextDue = v.budgetItems
      .map((b) => b.nextPaymentDueAt)
      .filter((d): d is Date => Boolean(d))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const status = STATUSES.find((x) => x.value === v.status)?.label ?? v.status;
    const tone = v.status === "booked" ? "status-success" : v.status === "declined" ? "status-muted" : v.status === "quoted" ? "status-warning" : "status-muted";
    return { v, agreed, paid, nextDue, status, tone };
  });
  const editPanel = (v: (typeof vendors)[number]) => (
    <div className="space-y-5">
      {vendorForm(v)}
      <form action={deleteVendorAction} className="border-t border-[var(--border-soft)] pt-4">
        <input type="hidden" name="weddingId" value={wedding.id} />
        <input type="hidden" name="vendorId" value={v.id} />
        <ConfirmSubmit message={`Remove ${v.name}? Budget lines linked to this vendor stay in the budget.`} className="btn-danger-quiet">
          Remove vendor
        </ConfirmSubmit>
      </form>
    </div>
  );
  const budgetCell = (r: (typeof rows)[number]) =>
    r.v.budgetItems.length > 0 ? (
      <>
        <span className="tabular-nums">
          {formatMinor(r.paid, currency)} paid{r.agreed > 0 ? ` of ${formatMinor(r.agreed, currency)}` : ""}
        </span>
        {r.nextDue ? <span className="block text-xs text-[var(--warning)]">Next payment {due(r.nextDue)}</span> : null}
      </>
    ) : (
      <form action={addVendorToBudgetAction}>
        <input type="hidden" name="weddingId" value={wedding.id} />
        <input type="hidden" name="vendorId" value={r.v.id} />
        <button type="submit" className="btn-secondary btn-sm">
          Add to budget
        </button>
      </form>
    );
  const contact = (v: (typeof vendors)[number]) => [v.contactName, v.phone, v.email].filter(Boolean).join(" · ");

  return (
    <main className="app-shell">
      <PageHeader
        title="Vendors"
        meta={vendors.length > 0 && !statusFilter ? `${vendors.filter((v) => v.status === "booked").length} booked of ${vendors.length}` : undefined}
        actions={
          <DialogTrigger
            title="Add vendor"
            triggerClassName="btn-primary"
            label={
              <>
                <Plus className="h-4 w-4" aria-hidden />
                Add vendor
              </>
            }
          >
            {vendorForm()}
          </DialogTrigger>
        }
      />
      <Feedback saved={sp.saved} error={sp.error} />

      <nav aria-label="Filter vendors by status" className="segmented mb-4 max-w-full overflow-x-auto">
        <Link href="/admin/vendors" aria-current={!statusFilter ? "true" : undefined}>
          All
        </Link>
        {STATUSES.map((s) => (
          <Link key={s.value} href={`/admin/vendors?status=${s.value}`} aria-current={statusFilter === s.value ? "true" : undefined} className="whitespace-nowrap">
            {s.label}
          </Link>
        ))}
      </nav>

      {vendors.length === 0 ? (
        <EmptyState title={statusFilter ? "No vendors with this status" : "No vendors yet"}>
          {statusFilter ? undefined : "Keep quotes, bookings and contacts for caterers, photographers and others here."}
        </EmptyState>
      ) : (
        <>
          <ul className="list-rows md:hidden">
            {rows.map((r) => (
              <li key={r.v.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium break-words">{r.v.name}</p>
                    <p className="text-xs text-[var(--muted-text)]">
                      {r.v.category}
                      {r.v.quoteMinor !== null ? ` · quote ${formatMinor(r.v.quoteMinor, currency)}` : ""}
                    </p>
                  </div>
                  <span className={`status ${r.tone} shrink-0`}>{r.status}</span>
                </div>
                {contact(r.v) ? <p className="mt-1 text-sm break-words">{contact(r.v)}</p> : null}
                {r.v.notes ? <p className="mt-1 text-sm break-words text-[var(--muted-text)]">{r.v.notes}</p> : null}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  {budgetCell(r)}
                  <DialogTrigger title={`Edit ${r.v.name}`} label="Edit" triggerClassName="btn-ghost btn-sm ml-auto">
                    {editPanel(r.v)}
                  </DialogTrigger>
                </div>
              </li>
            ))}
          </ul>
          <div className="app-card hidden md:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Vendor</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">
                    Quote
                  </th>
                  <th scope="col">Budget</th>
                  <th scope="col">Contact</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.v.id}>
                    <td className="max-w-[16rem]">
                      <p className="font-medium break-words">{r.v.name}</p>
                      <p className="text-xs text-[var(--muted-text)]">{r.v.category}</p>
                      {r.v.notes ? <p className="mt-0.5 line-clamp-2 text-xs text-[var(--muted-text)]" title={r.v.notes}>{r.v.notes}</p> : null}
                    </td>
                    <td>
                      <span className={`status ${r.tone}`}>{r.status}</span>
                    </td>
                    <td className="text-right tabular-nums">{r.v.quoteMinor !== null ? formatMinor(r.v.quoteMinor, currency) : <span className="text-[var(--muted-text)]">—</span>}</td>
                    <td>{budgetCell(r)}</td>
                    <td className="max-w-[14rem] text-sm break-words">
                      {contact(r.v) || <span className="text-[var(--muted-text)]">—</span>}
                      {r.v.website ? (
                        <a href={r.v.website} className="text-link block text-xs" rel="noopener noreferrer" target="_blank">
                          Website
                        </a>
                      ) : null}
                    </td>
                    <td className="text-right">
                      <DialogTrigger title={`Edit ${r.v.name}`} label="Edit" triggerClassName="btn-ghost btn-sm" triggerAriaLabel={`Edit ${r.v.name}`}>
                        {editPanel(r.v)}
                      </DialogTrigger>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
