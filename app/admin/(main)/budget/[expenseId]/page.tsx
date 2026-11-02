import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadPlanningPage } from '@/lib/workspace-page';
import { financeSnapshot } from '@/lib/finance-read';
import { itemFigures } from '@/lib/budget';
import { formatMinor } from '@/lib/money';
import { PageHeader } from '@/components/admin/planning-ui';
import { FinanceDialog,FinanceLive } from '@/components/admin/finance/finance-dialog';
import { ExpenseFields } from '@/components/admin/finance/fields';
import { PaymentButton,PaymentHistory } from '@/components/admin/finance/records';
export const dynamic='force-dynamic';
export default async function ExpenseDetails({params}:{params:Promise<{expenseId:string}>}){
 const {wedding}=await loadPlanningPage();if(!wedding)notFound();const data=await financeSnapshot(wedding.id);const {expenseId}=await params;const item=data.items.find(i=>i.id===expenseId);if(!item)notFound();
 const figures=itemFigures(item,data.headcounts);const remaining=figures.plannedMinor-figures.paidMinor;
 return <main className="app-shell finance-shell"><FinanceLive weddingId={wedding.id}/><PageHeader title={item.label} meta={`${item.category} · ${item.event?.title??'Whole wedding'}`} back={{href:'/admin/budget',label:'Budget'}} actions={<><FinanceDialog label="Edit expense" title="Edit expense" operation="expense.save" weddingId={wedding.id} initial={{id:item.id,version:item.version}}><ExpenseFields item={item} currency={wedding.currency} vendors={data.vendors.filter(v=>!v.deletedAt||v.id===item.vendorId)} events={data.events.filter(e=>!e.deletedAt||e.id===item.eventId)}/></FinanceDialog><PaymentButton weddingId={wedding.id} item={item} currency={wedding.currency}/></>}/>
  {item.vendor?<p className="mb-5 text-sm text-[var(--muted-text)]">Vendor: {item.vendor.deletedAt?<span>{item.vendor.name}</span>:<Link href={`/admin/vendors/${item.vendor.id}`} className="text-link">{item.vendor.name}</Link>}{item.vendor.deletedAt?' · removed vendor':''}</p>:null}
  {data.legacyQuoteCosts.has(item.id)?<p className="notice-warning mb-5">This legacy agreed cost may have been copied from a quote. Review the amount with Edit expense, then save to confirm the agreement.</p>:null}
  {data.duplicates.has(item.id)?<p className="notice-warning mb-5">A similar expense exists. Review both records before adding another payment; nothing has been merged.</p>:null}
  <dl className="finance-cost-strip"><div><dt>{figures.source==='agreed'?'Agreed cost':'Estimated cost'}</dt><dd>{formatMinor(figures.plannedMinor,wedding.currency)}</dd></div><div><dt>Paid</dt><dd>{formatMinor(figures.paidMinor,wedding.currency)}</dd></div><div><dt>{remaining<0?'Overpaid':'Remaining'}</dt><dd className={remaining<0?'text-[var(--danger)]':''}>{formatMinor(Math.abs(remaining),wedding.currency)}</dd></div></dl>
  {figures.source!=='agreed'?<p className="mt-3 text-sm text-[var(--muted-text)]">This cost is still an estimate. No amount has been agreed.</p>:null}
  {item.nextPaymentDueAt?<p className="notice-info mt-5">Legacy payment reminder: {item.nextPaymentDueAt.toISOString().slice(0,10)}. No installment amount or payment schedule was recorded, so this is not counted as an overdue installment.</p>:null}
  <section className="mt-9 max-w-3xl" aria-labelledby="expense-payments"><h2 id="expense-payments" className="section-heading">Payment history</h2><PaymentHistory items={[item]} weddingId={wedding.id} currency={wedding.currency}/></section>
  {item.notes?<section className="mt-8 max-w-prose"><h2 className="section-heading">Notes</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--muted-text)]">{item.notes}</p></section>:null}
  <div className="mt-12 border-t border-[var(--border-soft)] pt-5"><FinanceDialog label="Remove expense" title="Remove expense?" description="The expense and its payment records will be kept for recovery but excluded from totals." operation="expense.remove" weddingId={wedding.id} initial={{id:item.id,version:item.version}} submitLabel="Remove expense" className="btn-danger-quiet" navigate><label className="flex gap-2 text-sm"><input type="checkbox" name="confirmRemoval" required className="mt-1"/>Remove this expense from the active budget.</label></FinanceDialog></div>
 </main>;
}
