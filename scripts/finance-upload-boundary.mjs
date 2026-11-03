/** Full HTTP 10 MB limit test on a fresh isolated local database and server. */
import { PrismaClient } from './prisma-client.mjs';
import { spawn,spawnSync } from 'node:child_process';
import { randomBytes,randomUUID,createHash } from 'node:crypto';
import { SignJWT } from 'jose';
import { writeFileSync } from 'node:fs';
import { contractImages } from './finance-test-files.mjs';
import sharp from 'sharp';
const name=`rsvp_finance_upload_test_${Date.now()}`;
const url=`postgresql://postgres@127.0.0.1:54330/${name}`;
const admin=new PrismaClient({datasources:{db:{url:'postgresql://postgres@127.0.0.1:54330/postgres'}},log:[]});
await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);await admin.$disconnect();
const secret=randomBytes(32).toString('hex');const env={...process.env,NODE_ENV:'production',DATABASE_URL:url,DIRECT_URL:url,VOWPAL_DEMO:'0',ADMIN_AUTH_SECRET:secret,RESEND_API_KEY:'',ANTHROPIC_API_KEY:''};
const migrated=spawnSync('node_modules/.bin/prisma',['migrate','deploy'],{env,stdio:'pipe'});if(migrated.status!==0)throw new Error('Isolated migration replay failed.');
const db=new PrismaClient({datasources:{db:{url}},log:[]});let server;
try{
 await db.user.create({data:{id:'upload_test_user',name:'Upload boundary fixture',role:'event_creator',passwordHash:'unused-fixture'}});
 await db.wedding.create({data:{id:'upload_test_wedding',name:'Upload fixture',memberships:{create:{userId:'upload_test_user',role:'owner'}}}});
 await db.vendor.create({data:{id:'upload_test_vendor',weddingId:'upload_test_wedding',name:'Upload fixture',category:'Other'}});
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3003'],{env,stdio:'ignore'});
 let ready=false;for(let i=0;i<40;i++){if(server.exitCode!==null)throw new Error('Local test server failed.');try{ready=(await fetch('http://127.0.0.1:3003/admin/login',{signal:AbortSignal.timeout(500)})).status===200;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,250));}if(!ready)throw new Error('Local test server unavailable.');
 const token=await new SignJWT({role:'admin',userId:'upload_test_user',name:'Upload fixture',userRole:'event_creator'}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('10m').sign(new TextEncoder().encode(secret));
 const origin='http://127.0.0.1:3003';const headers={cookie:`admin_session=${token}`,origin};const base=`${origin}/admin/api/vendors/upload_test_vendor/contracts`;
 const image=(await contractImages()).png;const exact=Buffer.concat([image,Buffer.alloc(10*1024*1024-image.length)]);const key=randomUUID();
 async function upload(bytes,uploadKey){const body=new FormData();body.set('file',new File([bytes],'Boundary fixture.png',{type:'image/png'}));return fetch(base,{method:'POST',headers:{...headers,'x-upload-key':uploadKey},body});}
 const first=await upload(exact,key);if(first.status!==201)throw new Error(`Exact 10 MB failed: ${first.status}`);const {id}=await first.json();
 const retry=await upload(exact,key);if(retry.status!==200||(await retry.json()).id!==id)throw new Error('Upload retry duplicated or failed.');
 const download=await fetch(`${base}/${id}`,{headers});const roundTrip=Buffer.from(await download.arrayBuffer());if(!roundTrip.equals(exact))throw new Error('10 MB file bytes changed.');
 const metadata=await sharp(roundTrip).metadata();if(metadata.width!==160)throw new Error('Stored PNG is not decodable.');
 const oversized=await upload(Buffer.concat([exact,Buffer.from([0])]),randomUUID());if(oversized.status!==400)throw new Error(`10 MB + 1 byte was not rejected: ${oversized.status}`);
 const result={database:name,bytes:exact.length,upload:first.status,retry:retry.status,download:download.status,byteMatch:true,decoded:true,tooLarge:oversized.status,rows:await db.vendorContract.count(),sha256:createHash('sha256').update(roundTrip).digest('hex')};
 writeFileSync('.impeccable/review/finance/http-upload-boundary.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{server?.kill('SIGTERM');await db.$disconnect();}
