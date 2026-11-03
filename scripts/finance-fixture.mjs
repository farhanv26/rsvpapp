/** Explicit, isolated synthetic weddings in the canonical local DB; never seeds normal startup. */
import { PrismaClient } from './prisma-client.mjs';
import { randomBytes } from 'node:crypto';
import { hash } from 'bcryptjs';
import { writeFileSync,mkdirSync } from 'node:fs';
const db=new PrismaClient({datasources:{db:{url:'postgresql://postgres@127.0.0.1:54330/rsvp_dev'}},log:[]});
try{
 const ownerId='finance_fixture_owner';
 const owner=await db.user.findUnique({where:{id:ownerId}});
 if(owner&&owner.name!=='[Fixture] Finance review')throw new Error('Fixture identity collision; no changes made.');
 if(!owner)await db.user.create({data:{id:ownerId,name:'[Fixture] Finance review',role:'event_creator',passwordHash:await hash(randomBytes(32).toString('hex'),12)}});
 for(const [id,name] of [['finance_fixture_main','[Fixture] VowPal finance'],['finance_fixture_before','[Fixture] Before finance review'],['finance_fixture_other','[Fixture] Other wedding']]){
  const old=await db.wedding.findUnique({where:{id},include:{memberships:true}});
  if(old&&(old.backfillKey!==id||old.memberships.some(m=>m.userId!==ownerId&&!(id==='finance_fixture_other'&&m.userId==='finance_fixture_outsider'))))throw new Error('Fixture ownership collision; no changes made.');
  if(!old)await db.wedding.create({data:{id,name,backfillKey:id,currency:'CAD',timezone:'America/Toronto',plannedBudgetMinor:2000000,memberships:{create:{userId:ownerId,role:'owner'}}}});
 }
 if(!await db.vendor.findUnique({where:{id:'finance_fixture_vogue_before'}})){
  await db.vendor.create({data:{id:'finance_fixture_vogue_before',weddingId:'finance_fixture_before',name:'Vogue',category:'Venue',status:'booked',quoteMinor:550000}});
  await db.budgetItem.create({data:{id:'finance_fixture_expense_before',weddingId:'finance_fixture_before',vendorId:'finance_fixture_vogue_before',label:'Venue hire',category:'Venue',estimateMinor:500000,agreedMinor:550000,payments:{create:{id:'finance_fixture_payment_before',amountMinor:100000,paidAt:new Date()}}}});
  await db.vendor.create({data:{id:'finance_fixture_quote_vendor',weddingId:'finance_fixture_before',name:'[Fixture] Booked quote diagnostic',category:'Other',status:'booked',quoteMinor:550000}});
 }
 mkdirSync('.local',{recursive:true});writeFileSync('.local/finance-fixture.json',JSON.stringify({ownerId,weddingId:'finance_fixture_main',beforeWeddingId:'finance_fixture_before',otherWeddingId:'finance_fixture_other'},null,2),{mode:0o600});
 console.log('Isolated finance fixtures ready in rsvp_dev. Existing accounts, weddings and memberships unchanged.');
}finally{await db.$disconnect();}
