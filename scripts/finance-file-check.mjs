import { PrismaClient } from './prisma-client.mjs';
import { createRequire } from 'node:module';
import { SignJWT } from 'jose';
import { randomUUID,createHash } from 'node:crypto';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { contractPdf,contractImages } from './finance-test-files.mjs';
import sharp from 'sharp';
createRequire(import.meta.url)('@next/env').loadEnvConfig(process.cwd(),true,{info(){},error(){}});
const db=new PrismaClient({datasources:{db:{url:'postgresql://postgres@127.0.0.1:54330/rsvp_dev'}},log:[]});
try{
 const ids=JSON.parse(readFileSync('.local/finance-review-ids.json','utf8'));
 const vendor=await db.vendor.findUniqueOrThrow({where:{id:ids.vendorId}});if(vendor.weddingId!=='finance_fixture_main')throw new Error('Not a fixture vendor.');
 const token=await new SignJWT({role:'admin',userId:'finance_fixture_owner',name:'[Fixture] Finance review',userRole:'event_creator'}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('10m').sign(new TextEncoder().encode(process.env.ADMIN_AUTH_SECRET));
 const origin='http://127.0.0.1:3000';const headers={cookie:`admin_session=${token}; active_wedding=finance_fixture_main`,origin};const base=`${origin}/admin/api/vendors/${vendor.id}/contracts`;
 // Retire only the exact earlier zero-page synthetic test file, keeping its bytes recoverable.
 const previous=await db.vendorContract.findFirst({where:{id:ids.fileId,vendorId:vendor.id}});
 if(previous&&previous.content.includes(Buffer.from('/Kids [] /Count 0')))await fetch(`${base}/${previous.id}`,{method:'DELETE',headers});
 const images=await contractImages();const inputs=[{name:'Vogue — synthetic agreement.pdf',type:'application/pdf',bytes:contractPdf()},{name:'Vogue fixture scan.png',type:'image/png',bytes:images.png},{name:'Vogue fixture photo.jpg',type:'image/jpeg',bytes:images.jpg}];
 const results=[];mkdirSync('.local/finance-contract-fixtures',{recursive:true});
 for(const input of inputs){
  writeFileSync(`.local/finance-contract-fixtures/${input.name}`,input.bytes);
  const form=new FormData();form.set('file',new File([input.bytes],input.name,{type:input.type}));
  const response=await fetch(base,{method:'POST',headers:{...headers,'x-upload-key':randomUUID()},body:form});if(![200,201].includes(response.status))throw new Error(`Upload failed for ${input.type}`);const {id}=await response.json();
  const preview=await fetch(`${base}/${id}?preview=1`,{headers});const bytes=Buffer.from(await preview.arrayBuffer());const download=await fetch(`${base}/${id}`,{headers});const downloaded=Buffer.from(await download.arrayBuffer());
  if(!bytes.equals(input.bytes)||!downloaded.equals(input.bytes))throw new Error('File bytes changed during round-trip.');
  if(input.type.startsWith('image/')){const metadata=await sharp(bytes).metadata();if(metadata.width!==160||metadata.height!==100)throw new Error('Preview image is not decodable.');}
  if(input.type==='application/pdf'&&!bytes.includes(Buffer.from('/Count 1')))throw new Error('PDF has no preview page.');
  results.push({id,name:input.name,type:input.type,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),preview:preview.headers.get('content-disposition'),download:download.headers.get('content-disposition'),byteMatch:true,decoded:input.type.startsWith('image/')?true:'one-page PDF structure verified; browser preview pending'});
 }
 writeFileSync('.impeccable/review/finance/file-operations.json',JSON.stringify(results,null,2));writeFileSync('.local/finance-review-ids.json',JSON.stringify({...ids,fileId:results[0].id},null,2));console.log(JSON.stringify(results,null,2));
}finally{await db.$disconnect();}
