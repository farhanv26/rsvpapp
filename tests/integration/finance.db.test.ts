// @vitest-environment node
import { beforeAll,afterAll,describe,it,expect,vi } from 'vitest';
import { randomUUID } from 'node:crypto';
const env=vi.hoisted(()=>{const url=process.env.WEDDING_TEST_DATABASE_URL??'';let enabled=false;try{const u=new URL(url);enabled=['127.0.0.1','localhost'].includes(u.hostname)&&u.pathname.includes('test');}catch{}process.env.DATABASE_URL=enabled?url:'postgresql://disabled@127.0.0.1:1/disabled_test';return{enabled};});
const auth=vi.hoisted(()=>({actor:null as null|{id:string;name:string;role:string}}));
vi.mock('@/lib/admin-api-auth',()=>({getCurrentAdminUserFromApi:async()=>auth.actor}));
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>undefined})}));
import { prisma } from '@/lib/prisma';
import { mutateFinance } from '@/lib/finance-service';
import { financeTotals } from '@/lib/budget';
import { POST as upload } from '@/app/admin/api/vendors/[vendorId]/contracts/route';
import { GET as readContract,DELETE as removeContract } from '@/app/admin/api/vendors/[vendorId]/contracts/[contractId]/route';
import { CONTRACT_MAX_BYTES } from '@/lib/contract-limits';
const a={id:'finance_test_a',name:'Finance test A',role:'event_creator'};const b={id:'finance_test_b',name:'Finance test B',role:'event_creator'};
const wa='finance_test_wa',wb='finance_test_wb';
const save=(body:Record<string,unknown>,actor=a)=>mutateFinance(actor,{weddingId:wa,requestKey:randomUUID(),...body});
const ctx=(vendorId:string,contractId='')=>({params:Promise.resolve({vendorId,contractId})});
const origin='http://localhost';
function fileRequest(vendorId:string,bytes:Uint8Array,name='agreement.pdf',type='application/pdf',key=randomUUID()){
 const form=new FormData();form.set('file',new File([new Uint8Array(bytes)],name,{type}));return new Request(`${origin}/admin/api/vendors/${vendorId}/contracts`,{method:'POST',headers:{origin,'x-upload-key':key},body:form});
}
describe.skipIf(!env.enabled)('connected finances with real Postgres',()=>{
 let vendorId='',expenseId='',paymentId='';
 beforeAll(async()=>{
  await prisma.$executeRawUnsafe('TRUNCATE "Wedding", "User" CASCADE');
  await prisma.user.createMany({data:[a,b].map(u=>({...u,passwordHash:'unused-test-only'}))});
  await prisma.wedding.create({data:{id:wa,name:'Finance A',currency:'CAD',timezone:'America/Toronto',plannedBudgetMinor:2000000,memberships:{create:{userId:a.id,role:'owner'}}}});
  await prisma.wedding.create({data:{id:wb,name:'Finance B',currency:'CAD',memberships:{create:{userId:b.id,role:'owner'}}}});
 });
 afterAll(()=>prisma.$disconnect());
 it('makes quick vendor creation idempotent and leaves quotes uncommitted',async()=>{
  const requestKey=randomUUID();const input={operation:'vendor.save',name:'Vogue',category:'Venue',status:'booked',quote:'5500',requestKey};
  const [first,second]=await Promise.all([save(input),save(input)]);vendorId=first.id;expect(second.id).toBe(vendorId);
  await expect(save({...input,name:'Changed after a lost response'})).rejects.toMatchObject({status:409});
  expect(await prisma.vendor.count({where:{weddingId:wa}})).toBe(1);expect(await prisma.budgetItem.count({where:{weddingId:wa}})).toBe(0);
 });
 it('records the 5500 cost and 1000 payment once, including concurrent retries',async()=>{
  const requestKey=randomUUID();const input={operation:'expense.save',vendorId,label:'Venue hire',category:'Venue',estimate:'5000',agreed:'5500',requestKey};
  const [first,second]=await Promise.all([save(input),save(input)]);expenseId=first.id;expect(second.id).toBe(expenseId);
  const paymentKey=randomUUID();const payment={operation:'payment.save',itemId:expenseId,expenseVersion:0,amount:'1000',paidAt:new Date().toISOString().slice(0,10),requestKey:paymentKey};
  await Promise.all([save(payment),save(payment)]);
  const row=await prisma.budgetItem.findUniqueOrThrow({where:{id:expenseId},include:{payments:true}});paymentId=row.payments[0].id;
  await expect(save({...payment,amount:'1100'})).rejects.toMatchObject({status:409});
  expect(row.payments).toHaveLength(1);expect(financeTotals([row])).toMatchObject({expectedMinor:550000,paidMinor:100000,outstandingMinor:450000});
 });
 it('shares edited costs and payments across vendor and Budget with exact CAD totals',async()=>{
  const expense=await prisma.budgetItem.findUniqueOrThrow({where:{id:expenseId}});
  await save({operation:'expense.save',id:expenseId,version:expense.version,vendorId,label:'Venue hire',category:'Venue',estimate:'5000',agreed:'5800'});
  await save({operation:'expense.save',label:'Clothing',category:'Attire',estimate:'200'});
  const items=await prisma.budgetItem.findMany({where:{weddingId:wa,deletedAt:null},include:{payments:{where:{deletedAt:null}}}});
  expect(financeTotals(items,new Map(),2000000)).toMatchObject({expectedMinor:600000,paidMinor:100000,outstandingMinor:500000,remainingBudgetMinor:1400000});
  expect(financeTotals(items.filter(i=>i.vendorId===vendorId)).outstandingMinor).toBe(480000);
  const vendor=await prisma.vendor.findUniqueOrThrow({where:{id:vendorId}});
  await save({operation:'vendor.save',id:vendorId,version:vendor.version,name:'Vogue',category:'Venue',status:'booked',quote:'7000'});
  expect((await prisma.budgetItem.findUniqueOrThrow({where:{id:expenseId}})).agreedMinor).toBe(580000);
 });
 it('edits/removes a payment, preserves history, and rejects stale totals and cross-wedding writes',async()=>{
  let expense=await prisma.budgetItem.findUniqueOrThrow({where:{id:expenseId}});let payment=await prisma.budgetPayment.findUniqueOrThrow({where:{id:paymentId}});
  await save({operation:'payment.save',id:paymentId,itemId:expenseId,expenseVersion:expense.version,version:payment.version,amount:'1200',paidAt:new Date().toISOString().slice(0,10),method:'Transfer',reference:'Fixture'});
  expect(financeTotals(await prisma.budgetItem.findMany({where:{weddingId:wa},include:{payments:{where:{deletedAt:null}}}}))).toMatchObject({paidMinor:120000,outstandingMinor:480000});
  await expect(save({operation:'payment.save',itemId:expenseId,expenseVersion:expense.version,amount:'50',paidAt:new Date().toISOString().slice(0,10)})).rejects.toMatchObject({status:409});
  await expect(save({operation:'expense.save',id:expenseId,version:99,label:'Attack'},b)).rejects.toMatchObject({status:404});
  await expect(save({operation:'payment.remove',itemId:expenseId,id:paymentId,confirmRemoval:true},b)).rejects.toMatchObject({status:404});
  expense=await prisma.budgetItem.findUniqueOrThrow({where:{id:expenseId}});payment=await prisma.budgetPayment.findUniqueOrThrow({where:{id:paymentId}});
  await save({operation:'payment.remove',itemId:expenseId,id:paymentId,expenseVersion:expense.version,version:payment.version,confirmRemoval:true});
  expect((await prisma.budgetPayment.findUniqueOrThrow({where:{id:paymentId}})).deletedAt).not.toBeNull();
  expect(financeTotals(await prisma.budgetItem.findMany({where:{weddingId:wa},include:{payments:true}})).paidMinor).toBe(0);
 });
 it('rejects invalid money, future dates and unconfirmed overpayments',async()=>{
  for(const amount of ['-1','abc5','1e3','1.234','0'])await expect(save({operation:'payment.save',itemId:expenseId,expenseVersion:3,amount,paidAt:new Date().toISOString().slice(0,10)})).rejects.toBeDefined();
  const expense=await prisma.budgetItem.findUniqueOrThrow({where:{id:expenseId}});
  await expect(save({operation:'payment.save',itemId:expenseId,expenseVersion:expense.version,amount:'6000',paidAt:new Date().toISOString().slice(0,10)})).rejects.toThrow('overpayment');
  await expect(save({operation:'payment.save',itemId:expenseId,expenseVersion:expense.version,amount:'50',paidAt:'2099-01-01'})).rejects.toThrow('future');
  await save({operation:'payment.save',itemId:expenseId,expenseVersion:expense.version,amount:'6000',paidAt:new Date().toISOString().slice(0,10),confirmOverpayment:true});
  expect(financeTotals(await prisma.budgetItem.findMany({where:{id:expenseId},include:{payments:true}})).outstandingMinor).toBe(-20000);
 });
 it('keeps multiple expenses per vendor and non-vendor expenses distinct; flags similar records',async()=>{
  await save({operation:'expense.save',vendorId,label:'Photography',estimate:'300',category:'Photography'});
  await expect(save({operation:'expense.save',vendorId,label:'Photography',estimate:'300',category:'Photography'})).rejects.toThrow('similar expense');
  expect(await prisma.budgetItem.count({where:{weddingId:wa,vendorId}})).toBe(2);
  expect(await prisma.budgetItem.count({where:{weddingId:wa,vendorId:null}})).toBe(1);
 });
 it('round-trips contract bytes, supports preview, de-duplicates concurrent uploads and denies another wedding',async()=>{
  auth.actor=a;const bytes=Buffer.from('%PDF-1.7\nSynthetic contract fixture\n%%EOF');const key=randomUUID();
  const responses=await Promise.all([upload(fileRequest(vendorId,bytes,'agreement.pdf','application/pdf',key),ctx(vendorId)),upload(fileRequest(vendorId,bytes,'agreement.pdf','application/pdf',key),ctx(vendorId))]);
  const ids=await Promise.all(responses.map(async r=>{expect([200,201]).toContain(r.status);return (await r.json()).id;}));expect(ids[0]).toBe(ids[1]);
  const preview=await readContract(new Request(`${origin}/file?preview=1`),ctx(vendorId,ids[0]));expect(preview.headers.get('content-disposition')).toContain('inline');expect(Buffer.from(await preview.arrayBuffer()).equals(bytes)).toBe(true);
  const download=await readContract(new Request(`${origin}/file`),ctx(vendorId,ids[0]));expect(download.headers.get('content-disposition')).toContain('attachment');expect(Buffer.from(await download.arrayBuffer()).equals(bytes)).toBe(true);
  auth.actor=b;expect((await readContract(new Request(`${origin}/file`),ctx(vendorId,ids[0]))).status).toBe(404);expect((await upload(fileRequest(vendorId,bytes),ctx(vendorId))).status).toBe(404);
  auth.actor=a;expect((await removeContract(new Request(`${origin}/file`,{method:'DELETE',headers:{origin}}),ctx(vendorId,ids[0]))).status).toBe(204);expect((await readContract(new Request(`${origin}/file`),ctx(vendorId,ids[0]))).status).toBe(404);
 });
 it('accepts exactly 10 MB, rejects larger files and safely retains long filename extensions',async()=>{
  auth.actor=a;const bytes=Buffer.alloc(CONTRACT_MAX_BYTES,32);bytes.write('%PDF-1.7\n');
  const result=await upload(fileRequest(vendorId,bytes,'long-contract-'.repeat(20)+'.pdf'),ctx(vendorId));expect(result.status).toBe(201);const {id}=await result.json();
  const saved=await prisma.vendorContract.findUniqueOrThrow({where:{id}});expect(saved.size).toBe(CONTRACT_MAX_BYTES);expect(saved.name.endsWith('.pdf')).toBe(true);expect(Array.from(saved.name).length).toBeLessThanOrEqual(160);
  const response=await upload(fileRequest(vendorId,Buffer.concat([bytes,Buffer.from('x')])),ctx(vendorId));expect(response.status).toBe(400);
 });
});
