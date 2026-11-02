/** Read-only page checks plus a synthetic attachment upload/removal in rsvp_demo only. */
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import { mkdirSync,writeFileSync } from 'node:fs';
const require=createRequire(import.meta.url);require('@next/env').loadEnvConfig(process.cwd(),false,{info(){},error(){}});
const db=new PrismaClient({datasources:{db:{url:'postgresql://postgres@127.0.0.1:54330/rsvp_demo'}}});
const base='http://127.0.0.1:3002';
const results=[];
async function cookie(id) {
 const user=await db.user.findFirstOrThrow({where:{id,active:true,deletedAt:null}});
 const jwt=await new SignJWT({role:'admin',userId:user.id,name:user.name,userRole:user.role}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('10m').sign(new TextEncoder().encode(process.env.ADMIN_AUTH_SECRET));
 return `vowpal_demo_session=${jwt}`;
}
try {
 const owner=await cookie('demo_aisha');const platform=await cookie('demo_platform_admin');
 const events=await db.event.findMany({where:{slug:{in:['demo-mehndi','demo-nikkah','demo-reception']},deletedAt:null}});
 const paths=['/','/admin/login','/admin/overview','/admin/guests','/admin/events','/admin/events/new','/admin/budget','/admin/vendors','/admin/settings','/admin/weddings','/admin/users','/admin/activity',...events.flatMap(e=>[`/admin/events/${e.id}`,`/admin/events/${e.id}/edit`])];
 for(const path of paths){
  const res=await fetch(base+path,{headers:{cookie:path==='/admin/users'||path==='/admin/activity'?platform:owner},redirect:'manual'});
  const html=await res.text();const ok=res.status===200&&!html.includes('NEXT_HTTP_ERROR_FALLBACK;500');
  results.push({path,status:res.status,ok,bytes:html.length});
  if(!ok)throw new Error(`Page failed: ${path} (${res.status})`);
 }
 const guest=await db.guest.findFirstOrThrow({where:{eventId:events[0].id,deletedAt:null}});
 const reply=await fetch(`${base}/rsvp/${guest.token}`);const invitation=await reply.text();
 const leaked=['Gate code 4412','Caterer brings 40 chairs','privateNotes'].some(s=>invitation.includes(s));
 results.push({path:'/rsvp/[private token]',status:reply.status,ok:reply.status===200&&!leaked,privateScheduleLeaked:leaked});
 if(leaked)throw new Error('Private schedule leaked into guest HTML.');
 const vendor=await db.vendor.findFirstOrThrow({where:{weddingId:events[0].weddingId,deletedAt:null}});
 const endpoint=`${base}/admin/api/vendors/${vendor.id}/contracts`;
 const form=new FormData();form.set('file',new File(['%PDF-1.7\nVowPal synthetic smoke test'],'synthetic-test.pdf',{type:'application/pdf'}));
 const upload=await fetch(endpoint,{method:'POST',headers:{cookie:owner,origin:base},body:form});
 if(upload.status!==201)throw new Error(`Upload failed: ${upload.status}`);
 const {id}=await upload.json();
 const download=await fetch(`${endpoint}/${id}`,{headers:{cookie:owner}});
 if(download.status!==200||await download.text()!=='%PDF-1.7\nVowPal synthetic smoke test')throw new Error('Download failed.');
 const remove=await fetch(`${endpoint}/${id}`,{method:'DELETE',headers:{cookie:owner,origin:base}});
 if(remove.status!==204)throw new Error('Removal failed.');
 const gone=await fetch(`${endpoint}/${id}`,{headers:{cookie:owner}});
 if(gone.status!==404)throw new Error('Removed attachment is still visible.');
 results.push({path:'/admin/api/vendors/[vendorId]/contracts',upload:upload.status,download:download.status,remove:remove.status,afterRemoval:gone.status,ok:true});
 mkdirSync('.impeccable/review/vowpal',{recursive:true});writeFileSync('.impeccable/review/vowpal/http-results.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,2));
}finally{await db.$disconnect();}
