import 'server-only';
import { prisma } from '@/lib/prisma';
import { summarizeEventAttendance } from '@/lib/attendance';
import type { EventHeadcount } from '@/lib/budget';
export async function financeSnapshot(weddingId:string){
  const [items,vendors,events]=await Promise.all([
    prisma.budgetItem.findMany({where:{weddingId,deletedAt:null},orderBy:{createdAt:'asc'},include:{payments:{where:{deletedAt:null},orderBy:[{paidAt:'desc'},{createdAt:'desc'}]},vendor:{select:{id:true,name:true,deletedAt:true}},event:{select:{id:true,title:true,deletedAt:true}}}}),
    prisma.vendor.findMany({where:{weddingId},orderBy:{name:'asc'},include:{contracts:{where:{deletedAt:null},orderBy:{createdAt:'desc'},select:{id:true,name:true,size:true,contentType:true,createdAt:true}}}}),
    prisma.event.findMany({where:{weddingId},orderBy:{eventDate:'asc'},include:{guests:{where:{deletedAt:null}}}}),
  ]);
  const headcounts=new Map<string,EventHeadcount>(events.map(event=>{const a=summarizeEventAttendance(event.guests);return [event.id,{invited:a.invitedPeople,confirmed:a.confirmedPeople}];}));
  const duplicates=new Set<string>();
  for(const item of items){if(items.some(other=>other.id!==item.id&&other.vendorId===item.vendorId&&other.eventId===item.eventId&&other.label.trim().toLocaleLowerCase()===item.label.trim().toLocaleLowerCase()))duplicates.add(item.id);}
  const legacyQuoteCosts=new Set(items.filter(item=>{
    const vendor=vendors.find(v=>v.id===item.vendorId);
    return !item.requestKey&&vendor?.status==='booked'&&vendor.quoteMinor!==null&&item.agreedMinor===vendor.quoteMinor&&item.estimateMinor===vendor.quoteMinor&&item.label.trim().toLocaleLowerCase()===vendor.name.trim().toLocaleLowerCase();
  }).map(item=>item.id));
  return {items,vendors,events,headcounts,duplicates,legacyQuoteCosts};
}
