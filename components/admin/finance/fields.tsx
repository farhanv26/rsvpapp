import type { BudgetItem,BudgetPayment,Vendor } from '@prisma/client';
import { minorToInput } from '@/lib/money';
import { paymentToday } from '@/lib/finance-date';
export function VendorFields({vendor,currency}:{vendor?:Vendor;currency:string}){
 return <>
  <label className="form-label">Vendor name<input name="name" autoFocus required maxLength={120} defaultValue={vendor?.name} className="input-luxe" placeholder="Vogue" /></label>
  <label className="form-label">Service<input name="category" maxLength={60} defaultValue={vendor?.category} className="input-luxe" placeholder="Venue, photography, catering…" /></label>
  {vendor?<><label className="form-label">Booking status<select name="status" defaultValue={vendor.status} className="input-luxe"><option value="considering">Considering</option><option value="quoted">Quote received</option><option value="booked">Booked</option><option value="declined">Not going ahead</option></select></label><label className="form-label">Latest quote ({currency})<input name="quote" inputMode="decimal" defaultValue={minorToInput(vendor.quoteMinor,currency)} className="input-luxe" /><span className="field-hint block">A quote does not change your agreed cost or budget.</span></label></>:null}
  <details className="finance-options"><summary>Contact details and notes <span className="font-normal text-[var(--muted-text)]">· optional</span></summary><div className="mt-4 space-y-4">
   <label className="form-label">Contact person<input name="contactName" maxLength={120} defaultValue={vendor?.contactName??''} className="input-luxe" /></label>
   <div className="grid gap-4 sm:grid-cols-2"><label className="form-label">Phone<input type="tel" name="phone" maxLength={40} defaultValue={vendor?.phone??''} className="input-luxe" /></label><label className="form-label">Email<input type="email" name="email" maxLength={160} defaultValue={vendor?.email??''} className="input-luxe" /></label></div>
   <label className="form-label">Website<input type="url" name="website" maxLength={200} defaultValue={vendor?.website??''} className="input-luxe" placeholder="https://" /></label>
   <label className="form-label">Notes<textarea name="notes" rows={2} maxLength={2000} defaultValue={vendor?.notes??''} className="input-luxe" /></label>
  </div></details>
 </>;
}
export function ExpenseFields({item,currency,vendors,events,vendorId,label,confirmCost=false}:{item?:BudgetItem;currency:string;vendors:{id:string;name:string;deletedAt?:Date|null}[];events:{id:string;title:string}[];vendorId?:string;label?:string;confirmCost?:boolean}){
 return <>
  <label className="form-label">Expense name<input name="label" autoFocus required maxLength={120} defaultValue={item?.label??label} className="input-luxe" placeholder="Venue hire" /></label>
  {confirmCost?<input type="hidden" name="estimate" value={minorToInput(item?.estimateMinor??0,currency)}/>:null}<div className={`grid gap-4 ${confirmCost?'':'sm:grid-cols-2'}`}>{!confirmCost?<label className="form-label">Estimated cost ({currency})<input name="estimate" inputMode="decimal" defaultValue={minorToInput(item?.estimateMinor,currency)} className="input-luxe" placeholder="0.00" /></label>:null}<label className="form-label">Agreed cost ({currency})<input name="agreed" required={confirmCost} inputMode="decimal" defaultValue={minorToInput(item?.agreedMinor,currency)} className="input-luxe" placeholder="Not agreed yet" /></label></div>
  <p className="text-xs leading-relaxed text-[var(--muted-text)]">Expected cost uses the agreed cost when set, otherwise your estimate.</p>
  {vendorId?<input type="hidden" name="vendorId" value={vendorId}/>:<label className="form-label">Vendor<select name="vendorId" defaultValue={item?.vendorId??vendorId??''} className="input-luxe"><option value="">No vendor</option>{vendors.map(v=><option key={v.id} value={v.id} disabled={Boolean(v.deletedAt)&&v.id!==item?.vendorId}>{v.name}{v.deletedAt?' (removed)':''}</option>)}</select></label>}
  <details className="finance-options"><summary>Event, category and notes <span className="font-normal text-[var(--muted-text)]">· optional</span></summary><div className="mt-4 space-y-4">
   <label className="form-label">Event<select name="eventId" defaultValue={item?.eventId??''} className="input-luxe"><option value="">Whole wedding</option>{events.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
   <label className="form-label">Category<input name="category" maxLength={60} defaultValue={item?.category??'Other'} className="input-luxe" /></label>
   <label className="form-label">Notes<textarea name="notes" rows={2} maxLength={1000} defaultValue={item?.notes??''} className="input-luxe" /></label>
   {item?.perPersonMinor!==null&&item?.perPersonMinor!==undefined?<><label className="form-label">Per-person estimate ({currency})<input name="perPerson" inputMode="decimal" defaultValue={minorToInput(item.perPersonMinor,currency)} className="input-luxe" /></label><label className="form-label">Headcount<select name="perPersonBasis" defaultValue={item.perPersonBasis??'invited'} className="input-luxe"><option value="invited">Invited</option><option value="confirmed">Confirmed</option></select></label></>:null}
  </div></details>
 </>;
}
export function PaymentFields({currency,payment,timezone}:{currency:string;payment?:BudgetPayment;timezone:string}){
 const today=paymentToday(timezone);
 return <>
  <div className="grid gap-4 sm:grid-cols-2"><label className="form-label">Amount ({currency})<input name="amount" autoFocus required inputMode="decimal" defaultValue={minorToInput(payment?.amountMinor,currency)} className="input-luxe" placeholder="0.00" /></label><label className="form-label">Date paid<input name="paidAt" type="date" required max={today} defaultValue={payment?payment.paidAt.toISOString().slice(0,10):today} className="input-luxe" /></label></div>
  <details className="finance-options"><summary>Method, reference and notes <span className="font-normal text-[var(--muted-text)]">· optional</span></summary><div className="mt-4 space-y-4">
   <label className="form-label">Method<input name="method" maxLength={60} defaultValue={payment?.method??''} className="input-luxe" placeholder="Bank transfer, cash…" /></label>
   <label className="form-label">Reference<input name="reference" maxLength={120} defaultValue={payment?.reference??''} className="input-luxe" /></label>
   <label className="form-label">Notes<textarea name="note" rows={2} maxLength={1000} defaultValue={payment?.note??''} className="input-luxe" /></label>
  </div></details>
 </>;
}
