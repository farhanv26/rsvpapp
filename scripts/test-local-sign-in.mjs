/** Synthetic HTTP regression. Fixed disposable database; never alters Farhan or rsvp_dev. */
import { PrismaClient } from './prisma-client.mjs';
import { randomBytes } from 'node:crypto';
import { hash } from 'bcryptjs';
import { spawn } from 'node:child_process';
import { verifyLocalSignIn } from './local-sign-in-check.mjs';
const url='postgresql://postgres@127.0.0.1:54330/rsvp_vowpal_test_1793651858689';
const db=new PrismaClient({datasources:{db:{url}},log:[]});
let server; let user;
try {
  const password=randomBytes(24).toString('base64url');
  user=await db.user.create({data:{name:`Local Sign-in Test ${randomBytes(4).toString('hex')}`,role:'super_admin',passwordHash:await hash(password,4)}});
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3003'],{
    stdio:'ignore',env:{...process.env,NODE_ENV:'production',DATABASE_URL:url,DIRECT_URL:url,VOWPAL_DEMO:'0',ADMIN_AUTH_SECRET:randomBytes(32).toString('hex'),RESEND_API_KEY:'',ANTHROPIC_API_KEY:''},
  });
  let ready=false;
  for(let attempt=0;attempt<40;attempt++){
    if(server.exitCode!==null)throw new Error('Test server failed to start.');
    try{ready=(await fetch('http://127.0.0.1:3003/admin/login',{signal:AbortSignal.timeout(500)})).status===200;}catch{}
    if(ready)break;await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(!ready)throw new Error('Test server unavailable.');
  const page=await (await fetch('http://127.0.0.1:3003/admin/login')).text();
  if(page.includes(user.name)||page.includes('Demo Aisha')||page.includes('<select'))throw new Error('Account directory was exposed.');
  const success=await verifyLocalSignIn({name:`  ${user.name.toLowerCase()}  `,password,userId:user.id,port:3003});
  if(!success)throw new Error('HTTP sign-in failed.');
  if(await verifyLocalSignIn({name:user.name,password:` ${password}`,userId:user.id,port:3003}))throw new Error('Password whitespace was ignored.');
  await db.user.update({where:{id:user.id},data:{active:false}});
  if(await verifyLocalSignIn({name:user.name,password,userId:user.id,port:3003}))throw new Error('Inactive account signed in.');
  console.log('PASS: synthetic HTTP sign-in, protected overview, identifier normalization, exact password whitespace, inactive rejection, and no account directory. Farhan was not changed or signed in.');
} catch(error) {
  console.error(error.message);process.exitCode=1;
} finally {
  server?.kill('SIGTERM');
  if(user)await db.user.delete({where:{id:user.id}});
  await db.$disconnect();
}
