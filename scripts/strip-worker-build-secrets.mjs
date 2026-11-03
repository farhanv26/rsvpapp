// OpenNext compiles local .env files into this server module. These values must come
// exclusively from Worker bindings, never a bundled local/hosted credential fallback.
import { writeFile } from 'node:fs/promises';
const path=new URL('../.open-next/cloudflare/next-env.mjs',import.meta.url);
const compiled=await import(path.href);
const privateNames=new Set(['DATABASE_URL','DIRECT_URL','ADMIN_AUTH_SECRET','ADMIN_PASSWORD']);
const lines=[];
for(const [mode,values] of Object.entries(compiled)){
  const safe=Object.fromEntries(Object.entries(values).filter(([key])=>!privateNames.has(key)));
  lines.push(`export const ${mode} = ${JSON.stringify(safe)};`);
}
await writeFile(path,lines.join('\n')+'\n');
console.log('Removed private database/auth values from OpenNext environment fallbacks. Runtime bindings are required.');
