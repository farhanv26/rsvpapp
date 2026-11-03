/** Local-only read-only diagnostics. Never print hashes, passwords or connection credentials. */
import { PrismaClient } from './prisma-client.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync,readFileSync } from 'node:fs';
const connection=(database)=>new PrismaClient({datasources:{db:{url:`postgresql://postgres@127.0.0.1:54330/${database}`}},log:[]});
const admin=connection('rsvp_dev');
try {
  for (const port of [3000,3001,3002]) {
    let pids;
    try { pids=execFileSync('lsof',['-t',`-iTCP:${port}`,'-sTCP:LISTEN'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim().split('\n'); }
    catch { console.log(JSON.stringify({port,status:'not listening'}));continue; }
    const res=await fetch(`http://127.0.0.1:${port}/admin/login`);const html=await res.text();
    const sessions=await admin.$queryRaw`SELECT datname, client_port FROM pg_stat_activity WHERE client_addr = '127.0.0.1' AND pid <> pg_backend_pid()`;
    for(const pid of pids){
      const cwd=execFileSync('lsof',['-a','-p',pid,'-d','cwd','-Fn'],{encoding:'utf8'}).split('\n').find(l=>l.startsWith('n'))?.slice(1);
      const sockets=execFileSync('lsof',['-nP','-a','-p',pid,'-iTCP'],{encoding:'utf8'});
      const ports=[...sockets.matchAll(/127\.0\.0\.1:(\d+)->127\.0\.0\.1:54330/g)].map(m=>Number(m[1]));
      console.log(JSON.stringify({port,pid:Number(pid),project:cwd,host:'127.0.0.1',databasePort:54330,databases:[...new Set(sessions.filter(s=>ports.includes(s.client_port)).map(s=>s.datname))],loginStatus:res.status,accountDirectoryExposed:html.includes('<select'),demoEnvironmentLabel:html.includes('Demo environment · Fictional')}));
    }
  }
} finally {await admin.$disconnect();}
for (const database of ['rsvp_dev','rsvp_demo']) {
 const db=connection(database);
 try {
  const farhan=await db.user.findMany({where:{name:{equals:'Farhan',mode:'insensitive'}},select:{id:true,name:true,active:true,deletedAt:true,role:true,passwordHash:true,_count:{select:{weddingMemberships:true,events:true,managedGuests:true}}}});
  const wedding=await db.wedding.findUnique({where:{backfillKey:'demo-aisha-omar'},select:{id:true}});
  const weddingId=wedding?.id ?? '__no_seed_wedding__';
  const users=await db.user.findMany({where:{id:{in:['demo_aisha','demo_omar','demo_platform_admin']}},select:{id:true,name:true,active:true}});
  const events=await db.event.findMany({where:{slug:{in:['demo-mehndi','demo-nikkah','demo-reception']}},select:{id:true,weddingId:true,slug:true}});
  const eventIds=events.filter(e=>e.weddingId===weddingId).map(e=>e.id);
  const inventory={users,weddings:Number(Boolean(wedding)),events:events.length,householdInvitations:await db.guest.count({where:{eventId:{in:eventIds}}}),vendors:await db.vendor.count({where:{weddingId}}),budgetItems:await db.budgetItem.count({where:{weddingId}}),payments:await db.budgetPayment.count({where:{budgetItem:{weddingId}}}),eventRoles:await db.eventRole.count({where:{eventId:{in:eventIds}}}),placeAllocations:await db.eventAllocation.count({where:{eventId:{in:eventIds}}}),relatedActiveContracts:await db.vendorContract.count({where:{vendor:{weddingId},deletedAt:null}}),relatedRemovedContracts:await db.vendorContract.count({where:{vendor:{weddingId},deletedAt:{not:null}}})};
  const snapshot='.local/vowpal-backups/database-1793651399562.json';
  const prior=existsSync(snapshot)?JSON.parse(readFileSync(snapshot,'utf8')).User?.map(x=>x.row):[];
  console.log(JSON.stringify({database,farhan:farhan.map(({passwordHash,...user})=>({...user,validBcryptFormat:/^\$2[aby]\$\d\d\$/.test(passwordHash),...(database==='rsvp_dev'?{passwordHashUnchangedSincePrecleanupSnapshot:prior?.find(u=>u.id===user.id)?.passwordHash===passwordHash}:{})})),knownSeedInventory:inventory}));
 } finally {await db.$disconnect();}
}
