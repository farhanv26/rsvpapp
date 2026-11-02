import { PrismaClient } from '@prisma/client';
import { readFileSync,writeFileSync } from 'node:fs';
const db=new PrismaClient({datasources:{db:{url:'postgresql://postgres@127.0.0.1:54330/rsvp_dev'}},log:[]});
try{
 const snapshot=JSON.parse(readFileSync('.local/vowpal-backups/database-1793654509310.json','utf8'));let checked=0;const changed=[];
 for(const [table,rows] of Object.entries(snapshot)){
  const current=await db.$queryRawUnsafe(`SELECT row_to_json(t) AS row FROM "${table.replaceAll('"','""')}" t`);const byId=new Map(current.map(x=>[x.row.id,x.row]));
  for(const {row} of rows){checked++;const now=byId.get(row.id);if(!now){changed.push({table,id:row.id,fields:['missing']});continue;}const fields=Object.keys(row).filter(key=>JSON.stringify(row[key])!==JSON.stringify(now[key]));if(fields.length)changed.push({table,id:row.id,fields});}
 }
 const result={existingRowsChecked:checked,changedExistingRows:changed,newAdditiveColumnsExcluded:true};writeFileSync('.impeccable/review/finance/preservation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await db.$disconnect();}
