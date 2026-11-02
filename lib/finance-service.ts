import 'server-only';
import { prisma } from '@/lib/prisma';
import { getWeddingAccess } from '@/lib/wedding-access';
import { parseMoneyToMinor } from '@/lib/money';
import { summarizeEventAttendance } from '@/lib/attendance';
import type { Prisma } from '@prisma/client';
import type { AccessActor } from '@/lib/wedding-policy';

export class FinanceError extends Error {
  constructor(message:string, public status=400) { super(message); }
}
type Input=Record<string,unknown>;
const str=(input:Input,key:string,max=200)=>String(input[key]??'').trim().slice(0,max);
const flag=(input:Input,key:string)=>input[key]===true||input[key]==='on';
const stale=()=>{throw new FinanceError('This record changed. Refresh the latest amounts, review your entries, then save again.',409);};
function amount(input:Input,key:string,currency:string,required=false) {
  const raw=str(input,key,100);
  if(!raw){if(required)throw new FinanceError('Enter an amount.');return null;}
  const value=parseMoneyToMinor(raw,currency);
  if(value===null)throw new FinanceError('Enter a valid amount, such as 1,250.50. Negative amounts and extra decimal places are not allowed.');
  return value;
}
function dateOnly(raw:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))throw new FinanceError('Choose a valid payment date.');
  const date=new Date(`${raw}T12:00:00Z`);
  if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==raw)throw new FinanceError('Choose a valid payment date.');
  return date;
}

async function expectedCost(tx:Prisma.TransactionClient,item:{agreedMinor:number|null;estimateMinor:number;perPersonMinor:number|null;perPersonBasis:string|null;eventId:string|null}) {
  if(item.agreedMinor!==null)return item.agreedMinor;
  if(item.perPersonMinor!==null&&item.eventId){
    const attendance=summarizeEventAttendance(await tx.guest.findMany({where:{eventId:item.eventId,deletedAt:null}}));
    return item.perPersonMinor*(item.perPersonBasis==='confirmed'?attendance.confirmedPeople:attendance.invitedPeople);
  }
  return item.estimateMinor;
}

/** All financial mutations serialize on their wedding and check optimistic versions. */
export async function mutateFinance(actor:AccessActor,input:Input) {
  const weddingId=str(input,'weddingId',40);
  const operation=str(input,'operation',40);
  if((await getWeddingAccess(actor,weddingId,{require:operation==='budget.save'?'owner':'member'})).status!=='ok')throw new FinanceError('Record not found.',404);
  const requestKey=str(input,'requestKey',80);
  if(!/^[a-f0-9-]{36}$/i.test(requestKey))throw new FinanceError('Refresh this form before saving.');
  return prisma.$transaction(async(tx)=>{
    await tx.$queryRaw`SELECT id FROM "Wedding" WHERE id = ${weddingId} FOR UPDATE`;
    const wedding=await tx.wedding.findUniqueOrThrow({where:{id:weddingId}});
    const currency=wedding.currency;
    if(operation==='budget.save'){
      if(String(input.previous??'')!==String(wedding.plannedBudgetMinor??''))stale();
      const plannedBudgetMinor=amount(input,'plannedBudget',currency,true);
      await tx.wedding.update({where:{id:weddingId},data:{plannedBudgetMinor}});
      return {id:weddingId,url:'/admin/budget'};
    }
    if(operation==='vendor.save'){
      const id=str(input,'id',40);const name=str(input,'name',120);
      if(!name)throw new FinanceError('Enter the vendor name.');
      const status=str(input,'status',20)||'considering';
      if(!['considering','quoted','booked','declined'].includes(status))throw new FinanceError('Choose a booking status.');
      const website=str(input,'website',200);
      if(website&&!/^https?:\/\//i.test(website))throw new FinanceError('Website must start with https:// or http://.');
      const email=str(input,'email',160);if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new FinanceError('Enter a valid email address.');
      const data={name,category:str(input,'category',60)||'Other',status,quoteMinor:amount(input,'quote',currency),contactName:str(input,'contactName',120)||null,email:email||null,phone:str(input,'phone',40)||null,website:website||null,notes:str(input,'notes',2000)||null};
      if(id){
        const old=await tx.vendor.findFirst({where:{id,weddingId,deletedAt:null}});
        if(!old)throw new FinanceError('Vendor not found.',404);
        if(old.version!==Number(input.version))stale();
        await tx.vendor.update({where:{id},data:{...data,version:{increment:1}}});
        return {id,url:`/admin/vendors/${id}`};
      }
      const previous=await tx.vendor.findFirst({where:{requestKey,weddingId}});
      if(previous){
        if(Object.entries(data).some(([key,value])=>previous[key as keyof typeof previous]!==value))throw new FinanceError('This request already saved a vendor with changed values. Close this form and open the saved vendor before editing it.',409);
        return {id:previous.id,url:`/admin/vendors/${previous.id}`};
      }
      const vendor=await tx.vendor.create({data:{...data,weddingId,requestKey}});
      return {id:vendor.id,url:`/admin/vendors/${vendor.id}`};
    }
    if(operation==='expense.save'||operation==='expense.link'){
      const id=str(input,'id',40);const vendorId=str(input,'vendorId',40)||null;
      const old=id?await tx.budgetItem.findFirst({where:{id,weddingId,deletedAt:null},include:{payments:{where:{deletedAt:null}}}}):null;
      if(id&&!old)throw new FinanceError('Expense not found.',404);
      if(old&&old.version!==Number(input.version))stale();
      if(vendorId&&!await tx.vendor.findFirst({where:{id:vendorId,weddingId,...(old?.vendorId===vendorId?{}:{deletedAt:null})}}))throw new FinanceError('Vendor not found.',404);
      if(operation==='expense.link'){
        if(!old||!vendorId)throw new FinanceError('Choose an expense and vendor.');
        if(old.vendorId&&old.vendorId!==vendorId)throw new FinanceError('This expense already belongs to another vendor. Review its link in Budget.');
        await tx.budgetItem.update({where:{id:old.id},data:{vendorId,version:{increment:1}}});
        return {id:old.id,url:`/admin/budget/${old.id}`};
      }
      const label=str(input,'label',120);if(!label)throw new FinanceError('Give the expense a name.');
      const eventId=str(input,'eventId',40)||null;
      if(eventId&&!await tx.event.findFirst({where:{id:eventId,weddingId,...(old?.eventId===eventId?{}:{deletedAt:null})}}))throw new FinanceError('Event not found.',404);
      const estimateMinor=amount(input,'estimate',currency)??0;
      const agreedMinor=amount(input,'agreed',currency);
      if(flag(input,'confirmCost')&&agreedMinor===null)throw new FinanceError('Enter the agreed cost to confirm this expense.');
      const perPersonMinor=input.perPerson===undefined?(old?.perPersonMinor??null):amount(input,'perPerson',currency);
      const perPersonBasis=perPersonMinor===null?null:(str(input,'perPersonBasis')||old?.perPersonBasis||'invited');
      if(perPersonMinor!==null&&!eventId)throw new FinanceError('A per-person estimate needs an event.');
      const paid=old?.payments.reduce((sum,p)=>sum+p.amountMinor,0)??0;
      if(paid>await expectedCost(tx,{agreedMinor,estimateMinor,perPersonMinor,perPersonBasis,eventId})&&!flag(input,'confirmOverpayment'))throw new FinanceError('Recorded payments exceed this cost. Confirm that you want to keep the overpayment.');
      const data={label,category:str(input,'category',60)||'Other',vendorId,eventId,estimateMinor,agreedMinor,perPersonMinor,perPersonBasis,notes:str(input,'notes',1000)||null};
      if(old){await tx.budgetItem.update({where:{id:old.id},data:{...data,requestKey:old.requestKey??requestKey,version:{increment:1}}});return {id:old.id,url:`/admin/budget/${old.id}`};}
      const previous=await tx.budgetItem.findFirst({where:{weddingId,requestKey}});
      if(previous){
        if(Object.entries(data).some(([key,value])=>previous[key as keyof typeof previous]!==value))throw new FinanceError('This request already saved an expense with changed values. Close this form and open the saved expense before editing it.',409);
        return {id:previous.id,url:`/admin/budget/${previous.id}`};
      }
      const similar=await tx.budgetItem.findFirst({where:{weddingId,vendorId,eventId,label:{equals:label,mode:'insensitive'},deletedAt:null}});
      if(similar&&!flag(input,'confirmDuplicate'))throw new FinanceError('A similar expense already exists. Link or edit it, or confirm that this is a separate expense.');
      const expense=await tx.budgetItem.create({data:{...data,weddingId,requestKey}});
      return {id:expense.id,url:`/admin/budget/${expense.id}`};
    }
    if(operation==='payment.save'||operation==='payment.remove'){
      const itemId=str(input,'itemId',40);
      const item=await tx.budgetItem.findFirst({where:{id:itemId,weddingId,deletedAt:null},include:{payments:{where:{deletedAt:null}}}});
      if(!item)throw new FinanceError('Expense not found.',404);
      const id=str(input,'id',40);
      if(!id&&operation==='payment.save'){
        const previous=await tx.budgetPayment.findFirst({where:{requestKey,budgetItemId:item.id}});
        if(previous){
          const same=previous.amountMinor===amount(input,'amount',currency,true)&&previous.paidAt.getTime()===dateOnly(str(input,'paidAt',10)).getTime()&&previous.method===(str(input,'method',60)||null)&&previous.reference===(str(input,'reference',120)||null)&&previous.note===(str(input,'note',1000)||null);
          if(!same||previous.deletedAt)throw new FinanceError('This request already saved a payment with changed values. Close this form and review payment history before editing it.',409);
          return {id:previous.id,url:`/admin/budget/${item.id}`};
        }
      }
      if(item.version!==Number(input.expenseVersion))stale();
      const old=id?item.payments.find(p=>p.id===id):null;
      if(id&&!old)throw new FinanceError('Payment not found.',404);
      if(old&&old.version!==Number(input.version))stale();
      if(operation==='payment.remove'){
        if(!old||!flag(input,'confirmRemoval'))throw new FinanceError('Confirm removal of this recorded payment.');
        await tx.budgetPayment.update({where:{id:old.id},data:{deletedAt:new Date(),version:{increment:1}}});
      }else{
        const amountMinor=amount(input,'amount',currency,true);
        if(!amountMinor)throw new FinanceError('Payment must be above zero.');
        const paidAt=dateOnly(str(input,'paidAt',10));
        const today=new Intl.DateTimeFormat('en-CA',{timeZone:wedding.timezone??'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        if(str(input,'paidAt',10)>today)throw new FinanceError('Record money already paid. The payment date cannot be in the future.');
        const paid=item.payments.reduce((sum,p)=>sum+(p.id===id?0:p.amountMinor),0)+amountMinor;
        const expected=await expectedCost(tx,item);
        if(paid>expected&&!flag(input,'confirmOverpayment'))throw new FinanceError('This creates an overpayment against the current cost. Review the amount and confirm to continue.');
        const data={amountMinor,paidAt,method:str(input,'method',60)||null,reference:str(input,'reference',120)||null,note:str(input,'note',1000)||null};
        if(old)await tx.budgetPayment.update({where:{id:old.id},data:{...data,version:{increment:1}}});
        else await tx.budgetPayment.create({data:{...data,budgetItemId:item.id,requestKey}});
      }
      await tx.budgetItem.update({where:{id:item.id},data:{version:{increment:1}}});
      return {id:item.id,url:`/admin/budget/${item.id}`};
    }
    if(operation==='expense.remove'){
      const item=await tx.budgetItem.findFirst({where:{id:str(input,'id',40),weddingId,deletedAt:null}});
      if(!item)throw new FinanceError('Expense not found.',404);
      if(item.version!==Number(input.version))stale();
      if(!flag(input,'confirmRemoval'))throw new FinanceError('Confirm removal. Recorded payments remain in the recoverable expense record.');
      await tx.budgetItem.update({where:{id:item.id},data:{deletedAt:new Date(),version:{increment:1}}});
      return {id:item.id,url:'/admin/budget'};
    }
    throw new FinanceError('Unknown action.');
  });
}
