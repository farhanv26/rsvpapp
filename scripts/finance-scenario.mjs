/** Acceptance scenario through canonical localhost app; only explicitly labelled fixture records. */
import { PrismaClient } from './prisma-client.mjs';
import { createRequire } from 'node:module';
import { randomUUID,randomBytes,createHash } from 'node:crypto';
import { SignJWT } from 'jose';
import { hash } from 'bcryptjs';
import { existsSync,readFileSync,writeFileSync,mkdirSync } from 'node:fs';
createRequire(import.meta.url)('@next/env').loadEnvConfig(process.cwd(),true,{info(){},error(){}});
const db=new PrismaClient({datasources:{db:{url:'postgresql://postgres@127.0.0.1:54330/rsvp_dev'}},log:[]});
const base='http://127.0.0.1:3000',weddingId='finance_fixture_main';
const keyFile='.local/finance-scenario-keys.json';const keys=existsSync(keyFile)?JSON.parse(readFileSync(keyFile,'utf8')):{};
function key(name){if(!keys[name]){keys[name]=randomUUID();writeFileSync(keyFile,JSON.stringify(keys,null,2),{mode:0o600});}return keys[name];}
async function cookie(id,workspace=weddingId){const user=await db.user.findUniqueOrThrow({where:{id},select:{name:true,role:true}});const token=await new SignJWT({role:'admin',userId:id,name:user.name,userRole:user.role}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('20m').sign(new TextEncoder().encode(process.env.ADMIN_AUTH_SECRET));return `admin_session=${token}; active_wedding=${workspace}`;}
const results=[];let session='';
async function mutation(body,expected=200,actor=session){const res=await fetch(`${base}/admin/api/finance`,{method:'POST',headers:{cookie:actor,origin:base,'content-type':'application/json'},body:JSON.stringify({weddingId,requestKey:randomUUID(),...body})});const data=await res.json();if(res.status!==expected)throw new Error(`${body.operation}: expected ${expected}, got ${res.status}: ${data.error??''}`);return data;}
async function expense(id){return db.budgetItem.findUniqueOrThrow({where:{id},include:{payments:{where:{deletedAt:null}}}});}
async function totals(){const rows=await db.budgetItem.findMany({where:{weddingId,deletedAt:null},include:{payments:{where:{deletedAt:null}}}});const expected=rows.reduce((s,i)=>s+(i.agreedMinor??i.estimateMinor),0);const paid=rows.reduce((s,i)=>s+i.payments.reduce((n,p)=>n+p.amountMinor,0),0);return{expected,paid,outstanding:expected-paid,remainingBudget:2000000-expected};}
function assert(value,message){if(!value)throw new Error(message);}
try{
 const wedding=await db.wedding.findUniqueOrThrow({where:{id:weddingId}});assert(wedding.backfillKey===weddingId&&wedding.currency==='CAD','Not the CAD fixture wedding.');
 session=await cookie('finance_fixture_owner');
 // A completed fixture is verified without replaying old creation payloads over later edits.
 if(existsSync('.impeccable/review/finance/scenario.json')&&existsSync('.local/finance-review-ids.json')){
  const ids=JSON.parse(readFileSync('.local/finance-review-ids.json','utf8'));
  const row=await expense(ids.expenseId);
  const vendor=await db.vendor.findUniqueOrThrow({where:{id:ids.vendorId}});
  assert(row.weddingId===weddingId&&vendor.weddingId===weddingId&&row.vendorId===vendor.id,'Fixture identity differs.');
  const total=await totals();
  assert(JSON.stringify(total)===JSON.stringify({expected:600000,paid:100000,outstanding:500000,remainingBudget:1400000}),'Existing fixture differs; preserved for review.');
  const html=await (await fetch(`${base}/admin/vendors/${vendor.id}`,{headers:{cookie:session}})).text();
  const budget=await (await fetch(`${base}/admin/budget`,{headers:{cookie:session}})).text();
  assert(html.includes('4,800.00')&&html.includes('5,800.00')&&budget.includes('14,000.00')&&budget.includes('6,000.00'),'Rendered server totals differ.');
  console.log(JSON.stringify({mode:'verify-existing-fixture',...total,pagesAgree:true}));
 }else{
 const vendorInput={operation:'vendor.save',name:'Vogue',category:'Venue',requestKey:key('vendor')};
 const vendors=await Promise.all([mutation(vendorInput),mutation(vendorInput)]);const vendorId=vendors[0].id;assert(vendorId===vendors[1].id,'Vendor retry duplicated.');
 let vendor=await db.vendor.findUniqueOrThrow({where:{id:vendorId}});
 await mutation({operation:'vendor.save',id:vendorId,version:vendor.version,name:'Vogue',category:'Venue',status:'booked',quote:'5500'});
 const expenseInput={operation:'expense.save',label:'Venue hire',category:'Venue',vendorId,estimate:'5000',agreed:'5500',requestKey:key('expense')};
 const expenses=await Promise.all([mutation(expenseInput),mutation(expenseInput)]);const expenseId=expenses[0].id;assert(expenseId===expenses[1].id,'Expense retry duplicated.');
 let row=await expense(expenseId);
 if(row.agreedMinor!==550000)await mutation({...expenseInput,id:expenseId,version:row.version});
 row=await expense(expenseId);
 const paymentInput={operation:'payment.save',itemId:expenseId,expenseVersion:row.version,amount:'1000',paidAt:new Date().toISOString().slice(0,10),requestKey:key('payment')};
 await Promise.all([mutation(paymentInput),mutation(paymentInput)]);
 row=await expense(expenseId);const paid=row.payments.reduce((s,p)=>s+p.amountMinor,0);assert(paid===100000,'First payment total must be CAD 1000.');
 results.push({step:'Agreed CAD 5500 and paid CAD 1000',remaining:row.agreedMinor-paid,expenseId,vendorId});
 await mutation({...expenseInput,id:expenseId,version:row.version,agreed:'5800'});
 await mutation({operation:'expense.save',label:'Clothing',category:'Attire',estimate:'200',requestKey:key('clothing')});
 const total=await totals();assert(JSON.stringify(total)===JSON.stringify({expected:600000,paid:100000,outstanding:500000,remainingBudget:1400000}),'Final totals differ from the required CAD scenario.');results.push({step:'Required totals in minor units',...total});
 const html=await (await fetch(`${base}/admin/vendors/${vendorId}`,{headers:{cookie:session}})).text();assert(html.includes('4,800.00')&&html.includes('5,800.00'),'Vendor did not reflect the budget update.');
 const budgetHtml=await (await fetch(`${base}/admin/budget`,{headers:{cookie:session}})).text();assert(budgetHtml.includes('14,000.00')&&budgetHtml.includes('6,000.00'),'Budget page totals were stale.');
 row=await expense(expenseId);const p=row.payments.find(p=>p.requestKey===key('payment'));assert(p,'Payment missing.');
 await mutation({operation:'payment.save',itemId:expenseId,id:p.id,version:p.version,expenseVersion:row.version,amount:'1200',paidAt:new Date().toISOString().slice(0,10),method:'Bank transfer',reference:'Synthetic fixture'});
 const edited=await totals();assert(edited.paid===120000&&edited.outstanding===480000,'Edited payment totals incorrect.');
 const editedVendor=await (await fetch(`${base}/admin/vendors/${vendorId}`,{headers:{cookie:session}})).text();assert(editedVendor.includes('4,600.00'),'Vendor payment edit was stale.');results.push({step:'Edited payment',...edited});
 row=await expense(expenseId);const editedPayment=row.payments.find(x=>x.id===p.id);
 await mutation({operation:'payment.save',itemId:expenseId,id:p.id,version:editedPayment.version,expenseVersion:row.version,amount:'1000',paidAt:new Date().toISOString().slice(0,10)});
 const outsiderId='finance_fixture_outsider';if(!await db.user.findUnique({where:{id:outsiderId}}))await db.user.create({data:{id:outsiderId,name:'[Fixture] Other wedding member',role:'event_creator',passwordHash:await hash(randomBytes(24).toString('hex'),12)}});
 await db.weddingMembership.upsert({where:{weddingId_userId:{weddingId:'finance_fixture_other',userId:outsiderId}},create:{weddingId:'finance_fixture_other',userId:outsiderId,role:'member'},update:{}});
 const outsider=await cookie(outsiderId,'finance_fixture_other');
 await mutation({operation:'expense.save',id:expenseId,version:0,label:'Forbidden'},404,outsider);
 await mutation({operation:'payment.remove',itemId:expenseId,id:p.id,confirmRemoval:true},404,outsider);
 const bytes=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
 const fileUrl=`${base}/admin/api/vendors/${vendorId}/contracts`;
 async function upload(){const body=new FormData();body.set('file',new File([bytes],'Vogue — synthetic agreement.pdf',{type:'application/pdf'}));const response=await fetch(fileUrl,{method:'POST',headers:{cookie:session,origin:base,'x-upload-key':key('upload')},body});assert([200,201].includes(response.status),'Contract upload failed.');return (await response.json()).id;}
 const files=await Promise.all([upload(),upload()]);assert(files[0]===files[1],'Upload retry duplicated file.');
 const download=await fetch(`${fileUrl}/${files[0]}`,{headers:{cookie:session}});const preview=await fetch(`${fileUrl}/${files[0]}?preview=1`,{headers:{cookie:session}});
 assert(createHash('sha256').update(Buffer.from(await download.arrayBuffer())).digest('hex')===createHash('sha256').update(bytes).digest('hex'),'Downloaded bytes differ.');assert(Buffer.from(await preview.arrayBuffer()).equals(bytes),'Preview bytes differ.');assert(preview.headers.get('content-disposition').startsWith('inline'),'Preview is not inline.');
 const denied=await fetch(`${fileUrl}/${files[0]}`,{headers:{cookie:outsider},redirect:'manual'});assert(denied.status===404,'Cross-wedding file access was allowed.');
 results.push({step:'Contract byte round-trip, inline preview, retry deduplication and cross-wedding isolation',passed:true,fileId:files[0]});
 results.push({step:'Final fixture totals after restoring CAD 1000 payment',...await totals()});
 mkdirSync('.impeccable/review/finance',{recursive:true});writeFileSync('.impeccable/review/finance/scenario.json',JSON.stringify(results,null,2));writeFileSync('.local/finance-review-ids.json',JSON.stringify({weddingId,vendorId,expenseId,fileId:files[0]},null,2));console.log(JSON.stringify(results,null,2));
 }
}finally{await db.$disconnect();}
