import { prisma } from '@/lib/prisma';
import { contractAccess, sameOrigin } from '@/lib/vendor-contract-access';
export const runtime = 'nodejs';
type Context = {params:Promise<{vendorId:string;contractId:string}>};
export async function GET(request:Request,{params}:Context) {
  const {vendorId,contractId} = await params;
  if (!await contractAccess(vendorId)) return new Response('Not found',{status:404});
  const row = await prisma.vendorContract.findFirst({where:{id:contractId,vendorId,deletedAt:null}});
  if (!row) return new Response('Not found',{status:404});
  return new Response(new Uint8Array(row.content),{headers:{
    'Content-Type':row.contentType,
    'Content-Length':String(row.size),
    'Content-Disposition':`${new URL(request.url).searchParams.get('preview')==='1'?'inline':'attachment'}; filename="contract"; filename*=UTF-8''${encodeURIComponent(row.name)}`,
    'Cache-Control':'private, no-store',
    'X-Content-Type-Options':'nosniff',
    'Content-Security-Policy':"default-src 'none'; sandbox",
  }});
}
export async function DELETE(request:Request,{params}:Context) {
  if (!sameOrigin(request)) return new Response('Forbidden',{status:403});
  const {vendorId,contractId} = await params;
  if (!await contractAccess(vendorId)) return new Response('Not found',{status:404});
  const result = await prisma.vendorContract.updateMany({where:{id:contractId,vendorId,deletedAt:null},data:{deletedAt:new Date()}});
  if (result.count) return new Response(null,{status:204});
  const removed=await prisma.vendorContract.findFirst({where:{id:contractId,vendorId},select:{id:true}});
  return new Response(null,{status:removed?204:404});
}
