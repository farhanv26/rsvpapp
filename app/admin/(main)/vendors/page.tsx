import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { loadPlanningPage } from '@/lib/workspace-page';
import { financeSnapshot } from '@/lib/finance-read';
import { financeTotals } from '@/lib/budget';
import { formatMinor } from '@/lib/money';
import { NoWeddingSelected,PageHeader,EmptyState } from '@/components/admin/planning-ui';
import { FinanceDialog,FinanceLive } from '@/components/admin/finance/finance-dialog';
import { VendorFields } from '@/components/admin/finance/fields';
export const dynamic='force-dynamic';
const statusLabel:Record<string,string>={considering:'Considering',quoted:'Quote received',booked:'Booked',declined:'Not going ahead'};
export default async function VendorsPage(){
 const {workspace,wedding}=await loadPlanningPage();
 if(!wedding)return <main className="app-shell"><PageHeader title="Vendors"/><NoWeddingSelected hasWeddings={workspace.weddings.length>0}/></main>;
 const data=await financeSnapshot(wedding.id);const vendors=data.vendors.filter(v=>!v.deletedAt);
 return <main className="app-shell finance-shell"><FinanceLive weddingId={wedding.id}/><PageHeader title="Vendors" meta={`${wedding.name} · ${vendors.length} ${vendors.length===1?'vendor':'vendors'}`} actions={<FinanceDialog label="Add vendor" title="Add vendor" operation="vendor.save" weddingId={wedding.id} submitLabel="Add vendor" className="btn-primary" navigate><VendorFields currency={wedding.currency}/></FinanceDialog>}/>
  {vendors.length?<div className="finance-vendors">{vendors.map(v=>{
   const items=data.items.filter(i=>i.vendorId===v.id);const total=financeTotals(items,data.headcounts);const paid=total.paidMinor;const remaining=total.expectedMinor-paid;const costLabel=!items.length||items.every(i=>i.agreedMinor!==null)?'Agreed cost':items.every(i=>i.agreedMinor===null)?'Estimated cost':'Expected cost';
   return <Link key={v.id} href={`/admin/vendors/${v.id}`} className="finance-vendor-row"><div className="min-w-0"><div className="flex items-center gap-3"><h2 className="text-lg font-semibold break-words">{v.name}</h2><ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--muted-text)]" aria-hidden/></div><p className="mt-1 text-sm text-[var(--muted-text)]">{v.category} · {statusLabel[v.status]??v.status}</p></div><dl className="grid grid-cols-3 gap-4 text-sm sm:min-w-96"><div><dt>{costLabel}</dt><dd>{items.length?formatMinor(total.expectedMinor,wedding.currency):'Not agreed'}</dd></div><div><dt>Paid</dt><dd>{formatMinor(paid,wedding.currency)}</dd></div><div><dt>{remaining<0?'Overpaid':'Remaining'}</dt><dd className={remaining<0?'text-[var(--danger)]':''}>{items.length?formatMinor(Math.abs(remaining),wedding.currency):'—'}</dd></div></dl></Link>;
  })}</div>:<EmptyState title="Keep your people and their costs connected">Add a vendor now. You can confirm the cost and attach contracts when you’re ready.</EmptyState>}
 </main>;
}
