/** Actual workerd/OpenNext login, fixed existing disposable database. No migrations/reset. */
import { unstable_dev } from 'wrangler';
import { PrismaClient } from './prisma-client.mjs';
import { randomBytes } from 'node:crypto';
import { hash } from 'bcryptjs';
import { spawn } from 'node:child_process';
const url='postgresql://postgres@127.0.0.1:54330/rsvp_vowpal_test_1793655880473';
const db=new PrismaClient({datasources:{db:{url}},log:[]});
let worker,user,wedding,nodeServer;
function assert(value,message){if(!value)throw new Error(message);}
try {
  await db.$queryRaw`SELECT 1`;
  const array=await db.$transaction([db.$queryRaw`SELECT 1 AS value`,db.$queryRaw`SELECT 2 AS value`]);
  assert(array[0][0].value===1&&array[1][0].value===2,'Array transaction failed.');
  const rollbackId=`worker_rollback_${randomBytes(8).toString('hex')}`;
  try{await db.$transaction(async tx=>{await tx.user.create({data:{id:rollbackId,name:rollbackId,passwordHash:'not-a-login',role:'event_creator'}});throw new Error('intentional rollback');});}catch(e){if(e.message!=='intentional rollback')throw e;}
  assert(!await db.user.findUnique({where:{id:rollbackId}}),'Interactive rollback failed.');
  const password=randomBytes(24).toString('base64url');
  user=await db.user.create({data:{name:`[Fixture] Worker login ${randomBytes(6).toString('hex')}`,role:'super_admin',passwordHash:await hash(password,4)}});
  worker=await unstable_dev('worker.ts',{
    config:'wrangler.jsonc',ip:'127.0.0.1',port:8788,local:true,persist:false,logLevel:'none',
    vars:{DATABASE_URL:url,ADMIN_AUTH_SECRET:randomBytes(32).toString('hex'),DIRECT_URL:'',RESEND_API_KEY:'',ANTHROPIC_API_KEY:'',VOWPAL_DEMO:'0'},
    experimental:{disableExperimentalWarning:true,disableDevRegistry:true,showInteractiveDevSession:false,watch:false},
  });
  let origin='http://127.0.0.1:8788';
  async function login(attemptPassword=password){
    const page=await fetch(`${origin}/admin/login`);assert(page.status===200,'Worker login page failed.');
    const html=await page.text();assert(!html.includes(user.name),'Login exposed account directory.');
    const action=html.match(/name="(\$ACTION_ID_[^"]+)"/);assert(action,'Login form action missing.');
    const form=new FormData();form.set(action[1],'');form.set('adminUser',`  ${user.name.toLowerCase()}  `);form.set('password',attemptPassword);
    const response=await fetch(`${origin}/admin/login`,{method:'POST',headers:{origin},body:form,redirect:'manual'});
    const cookie=response.headers.get('set-cookie')?.match(/(?:^|,\s*)(admin_session=[^;]+)/)?.[1];
    return {response,cookie};
  }
  // Consecutive and concurrent requests in the same isolate catch cross-request TCP reuse.
  for(let i=0;i<3;i++){
    const {response,cookie}=await login();assert(response.status===303&&cookie,'Worker database-backed login failed.');
    const claims=JSON.parse(Buffer.from(cookie.split('=')[1].split('.')[1],'base64url').toString());assert(claims.userId===user.id,'Wrong login identity.');
    const pages=await Promise.all([1,2].map(()=>fetch(`${origin}/admin/overview`,{headers:{cookie},redirect:'manual'})));
    for(const page of pages){const html=await page.text();assert(page.status===200&&html.includes('Overview')&&html.includes(user.name),'Worker protected overview failed.');}
  }
  const invalid=await login(`${password} `);assert(!invalid.cookie&&invalid.response.status===303,'Invalid password accepted.');
  const {cookie}=await login();
  wedding=await db.wedding.create({data:{name:'[Fixture] Worker transaction',currency:'CAD',memberships:{create:{userId:user.id,role:'owner'}}}});
  const headers={cookie:`${cookie}; active_wedding=${wedding.id}`,origin,'content-type':'application/json'};
  async function finance(body){const r=await fetch(`${origin}/admin/api/finance`,{method:'POST',headers,body:JSON.stringify({weddingId:wedding.id,...body})});assert(r.ok,'Worker financial transaction failed.');return r.json();}
  const requestKey=crypto.randomUUID();
  const input={operation:'expense.save',label:'Worker transaction fixture',estimate:'55',agreed:'55',requestKey};
  const costs=await Promise.all([finance(input),finance(input)]);assert(costs[0].id===costs[1].id,'Worker duplicate expense created.');
  const payment={operation:'payment.save',itemId:costs[0].id,expenseVersion:0,amount:'10',paidAt:new Date().toISOString().slice(0,10),requestKey:crypto.randomUUID()};
  await Promise.all([finance(payment),finance(payment)]);
  const item=await db.budgetItem.findUniqueOrThrow({where:{id:costs[0].id},include:{payments:true}});
  assert(item.agreedMinor===5500&&item.payments.length===1&&item.payments[0].amountMinor===1000,'Worker transaction totals differ.');
  nodeServer=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3003'],{stdio:'ignore',env:{...process.env,NODE_ENV:'production',DATABASE_URL:url,DIRECT_URL:url,ADMIN_AUTH_SECRET:randomBytes(32).toString('hex'),RESEND_API_KEY:'',ANTHROPIC_API_KEY:''}});
  origin='http://127.0.0.1:3003';
  let ready=false;
  for(let i=0;i<40;i++){if(nodeServer.exitCode!==null)break;try{ready=(await fetch(`${origin}/admin/login`)).status===200;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,100));}
  assert(ready,'Local Node compatibility server unavailable.');
  const nodeLogin=await login();assert(nodeLogin.cookie&&nodeLogin.response.status===303,'Local Node login compatibility failed.');
  const nodePage=await fetch(`${origin}/admin/overview`,{headers:{cookie:nodeLogin.cookie},redirect:'manual'});assert(nodePage.status===200&&(await nodePage.text()).includes('Overview'),'Local Node protected overview failed.');
  console.log('PASS: actual local Workers preview: database-backed form login x3, concurrent protected requests, runtime DATABASE_URL/ADMIN_AUTH_SECRET, invalid-password rejection; Worker financial transactions and concurrent idempotency; adapter array transaction and interactive rollback; local Node web login/overview compatibility.');
}catch(error){
  // Only our fixed assertions are printed; driver errors may carry sensitive details.
  console.error('Worker acceptance failed:',error.name,'(inspect locally without sharing secrets)');process.exitCode=1;
}finally{
  await worker?.stop();
  nodeServer?.kill('SIGTERM');
  if(wedding)await db.wedding.delete({where:{id:wedding.id}});
  if(user)await db.user.delete({where:{id:user.id}});
  await db.$disconnect();
}
