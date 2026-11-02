import { PrismaClient } from '@prisma/client';
import { hash, compare } from 'bcryptjs';
import { assertLocalAccountSetup } from './local-target.mjs';
import { verifyLocalSignIn } from './local-sign-in-check.mjs';

let db;
try {
  const url = assertLocalAccountSetup();
  if (process.stdin.isTTY) throw new Error('Use the interactive wrapper.');
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
    if (Buffer.byteLength(input) > 4096) throw new Error('Invalid input.');
  }
  const payload = JSON.parse(input); input = '';
  let password = payload.password; delete payload.password;
  if (typeof password !== 'string' || [...password].length < 12 || Buffer.byteLength(password) > 72) throw new Error('Invalid password length.');
  db = new PrismaClient({datasources:{db:{url}},log:[]});
  const matches = await db.user.findMany({where:{name:{equals:'Farhan',mode:'insensitive'}},select:{id:true,name:true,role:true}});
  if (matches.length > 1) throw new Error('Ambiguous local account.');
  const passwordHash = await hash(password, 12);
  const account = matches[0]
    ? await db.user.update({where:{id:matches[0].id},data:{passwordHash,active:true,deletedAt:null},select:{id:true,name:true,role:true}})
    : await db.user.create({data:{name:'Farhan',role:'super_admin',active:true,passwordHash},select:{id:true,name:true,role:true}});
  if (!await compare(password, passwordHash)) throw new Error('Password verification failed.');
  const signedIn = await verifyLocalSignIn({name:account.name,password,userId:account.id});
  password = undefined;
  console.log(`Local account ${matches.length ? 'updated' : 'created'}: ${account.name}. Existing identity and access ${matches.length ? 'preserved' : 'initialized locally'}.`);
  console.log(signedIn
    ? 'Sign-in tested successfully over local HTTP, including the protected overview page.'
    : 'Password hash verified. Sign-in has NOT been confirmed; start npm run dev, then sign in at http://127.0.0.1:3000/admin/login.');
} catch {
  console.error('Local account setup failed safely. No credentials were logged.');
  process.exitCode = 1;
} finally { await db?.$disconnect(); }
