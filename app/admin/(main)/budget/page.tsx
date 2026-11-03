import Link from 'next/link';
import { loadPlanningPage } from '@/lib/workspace-page';
import { financeSnapshot } from '@/lib/finance-read';
import { financeTotals } from '@/lib/budget';
import { formatMinor,minorToInput } from '@/lib/money';
import { NoWeddingSelected,PageHeader,EmptyState } from '@/components/admin/planning-ui';
import { FinanceDialog,FinanceLive } from '@/components/admin/finance/finance-dialog';
import { ExpenseFields } from '@/components/admin/finance/fields';
import { ExpenseRows } from '@/components/admin/finance/records';
export const dynamic='force-dynamic';
export default async function BudgetPage({searchParams}:{searchParams:Promise<{event?:string;category?:string}>}){
 const {workspace,wedding,isOwner}=await loadPlanningPage();
 if(!wedding)return <main className="app-shell"><PageHeader title="Budget"/><NoWeddingSelected hasWeddings={workspace.weddings.length>0}/></main>;
 const data=await financeSnapshot(wedding.id);const filters=await searchParams;
 const total=financeTotals(data.items,data.headcounts,wedding.plannedBudgetMinor);const money=(n:number)=>formatMinor(n,wedding.currency);
 const items=data.items.filter(i=>(!filters.event||i.eventId===filters.event)&&(!filters.category||i.category===filters.category));
 const categories=[...new Set(data.items.map(i=>i.category))];
 const showEventFilter=data.events.length>1||Boolean(filters.event);
 return <main className="app-shell finance-shell"><FinanceLive weddingId={wedding.id}/><PageHeader title="Budget" meta={`${wedding.name} · ${wedding.currency}`} actions={<FinanceDialog label="Add expense" title="Add expense" operation="expense.save" weddingId={wedding.id} className="btn-primary" submitLabel="Add expense" navigate><ExpenseFields currency={wedding.currency} vendors={data.vendors.filter(v=>!v.deletedAt)} events={data.events.filter(e=>!e.deletedAt)}/></FinanceDialog>}/>
  <section className="finance-budget-summary" aria-label="Wedding budget"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="section-heading">Your wedding budget</h2>{isOwner?<FinanceDialog label={wedding.plannedBudgetMinor===null?'Set budget':'Edit budget'} title="Wedding budget" operation="budget.save" weddingId={wedding.id} initial={{previous:wedding.plannedBudgetMinor??''}} className="btn-ghost btn-sm"><label className="form-label">Planned budget ({wedding.currency})<input name="plannedBudget" required autoFocus inputMode="decimal" defaultValue={minorToInput(wedding.plannedBudgetMinor,wedding.currency)} className="input-luxe"/></label></FinanceDialog>:null}</div>
   <dl className="mt-6 grid gap-6 sm:grid-cols-3"><div><dt>Planned budget</dt><dd>{wedding.plannedBudgetMinor===null?'Not set':money(wedding.plannedBudgetMinor)}</dd></div><div><dt>Expected cost</dt><dd>{money(total.expectedMinor)}</dd></div><div className="finance-remaining"><dt>Remaining budget</dt><dd className={total.remainingBudgetMinor!==null&&total.remainingBudgetMinor<0?'text-[var(--danger)]':''}>{total.remainingBudgetMinor===null?'—':money(total.remainingBudgetMinor)}</dd></div></dl>
  </section>
  <section className="mt-9" aria-labelledby="expenses-heading"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 id="expenses-heading" className="section-heading">Expenses <span className="ml-1 font-normal text-[var(--muted-text)]">{data.items.length}</span></h2><p className="text-sm tabular-nums text-[var(--muted-text)]">{money(total.paidMinor)} paid · {total.outstandingMinor<0?`${money(-total.outstandingMinor)} overpaid`:`${money(total.outstandingMinor)} outstanding`}</p></div>
   {data.events.length>1||categories.length>1||filters.event||filters.category?<form className="mb-4 flex flex-wrap items-end gap-3">{showEventFilter?<label className="form-label text-xs">Event<select name="event" defaultValue={filters.event??''} className="input-luxe"><option value="">All events</option>{data.events.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>:null}<label className="form-label text-xs">Category<select name="category" defaultValue={filters.category??''} className="input-luxe"><option value="">All categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label><button className="btn-secondary">Apply filters</button>{filters.event||filters.category?<Link href="/admin/budget" className="btn-ghost">Clear</Link>:null}</form>:null}
   {data.legacyQuoteCosts.size?<p className="notice-warning mb-4">Some legacy agreed costs may have been copied from vendor quotes. Review and save the expense to confirm the agreement; existing amounts have been kept.</p>:null}
   {data.duplicates.size?<p className="notice-warning mb-4">Some expenses have matching names and links. Review the marked records; nothing has been merged.</p>:null}
   {items.length?<ExpenseRows items={items} headcounts={data.headcounts} duplicates={data.duplicates} currency={wedding.currency}/>:<EmptyState title={data.items.length?'No matching expenses':'A clear place for every expense'}>{data.items.length?'Clear the filters to see your expenses.':'Add vendor costs, clothing, travel or anything else you’re planning for.'}</EmptyState>}
   {data.items.some(i=>i.agreedMinor===null)?<p className="mt-3 text-xs text-[var(--muted-text)]">Expected cost includes estimates until an agreed cost is set.</p>:null}
  </section>
 </main>;
}
