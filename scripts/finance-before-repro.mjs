import { PrismaClient } from '@prisma/client';
import { createRequire } from 'node:module';
import { SignJWT } from 'jose';
import { mkdirSync,writeFileSync } from 'node:fs';
createRequire(import.meta.url)('@next/env').loadEnvConfig(process.cwd(),true,{info(){},error(){}});
const db=new PrismaClient({datasources:{db:{url:'postgresql://postgres@127.0.0.1:54330/rsvp_dev'}},log:[]});
try{
 const token=await new SignJWT({role:'admin',userId:'finance_fixture_owner',name:'[Fixture] Finance review',userRole:'event_creator'}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('15m').sign(new TextEncoder().encode(process.env.ADMIN_AUTH_SECRET));
 const cookie=`admin_session=${token}; active_wedding=finance_fixture_before`;
 const origin='http://127.0.0.1:3000';
 const html=await (await fetch(`${origin}/admin/vendors`,{headers:{cookie}})).text();
 mkdirSync('.local/finance-before',{recursive:true});writeFileSync('.local/finance-before/vendors-response.html',html);
 const forms=[...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(m=>m[0]);
 const target=forms.find(f=>f.includes('finance_fixture_quote_vendor')&&f.includes('Add to budget'));
 const result={foundLegacyForm:Boolean(target),inheritedRightAlignment:html.includes('class="text-right"'),quoteWasPromoted:false};
 if(target){
  const body=new FormData();
  for(const tag of target.matchAll(/<input\b[^>]*>/g)){
   const attrs=Object.fromEntries([...tag[0].matchAll(/([\w$-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
   if(attrs.name)body.set(attrs.name,attrs.value??'');
  }
  await fetch(`${origin}/admin/vendors`,{method:'POST',headers:{cookie,origin},body,redirect:'manual'});
  const rows=await db.budgetItem.findMany({where:{weddingId:'finance_fixture_before',vendorId:'finance_fixture_quote_vendor'},select:{id:true,agreedMinor:true,estimateMinor:true}});
  result.quoteWasPromoted=rows.some(r=>r.agreedMinor===550000);result.rows=rows;
 }
 writeFileSync('.local/finance-before/reproduction.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await db.$disconnect();}
