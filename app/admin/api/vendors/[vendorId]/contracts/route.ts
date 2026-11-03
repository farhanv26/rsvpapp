import { createHash,randomUUID } from 'node:crypto';
import { contractAccess, sameOrigin } from '@/lib/vendor-contract-access';
import { prisma } from '@/lib/prisma';
import { CONTRACT_MAX_BYTES, safeContractName, validateContract } from '@/lib/vendor-contract-validation';

export const runtime = 'nodejs';
export async function POST(request: Request, {params}: {params: Promise<{vendorId:string}>}) {
  if (!sameOrigin(request)) return Response.json({error:'Request origin is not allowed.'},{status:403});
  const {vendorId} = await params;
  if (!await contractAccess(vendorId)) return Response.json({error:'Vendor not found.'},{status:404});
  // Bound the body while streaming, including chunked requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return Response.json({error:'Choose a file.'},{status:400});
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const {done,value} = await reader.read(); if (done) break;
    size += value.length;
    if (size > CONTRACT_MAX_BYTES + 65536) {
      await reader.cancel();
      return Response.json({error:'Choose a file up to 10 MB.'},{status:413});
    }
    chunks.push(value);
  }
  let form: FormData;
  try { form = await new Response(Buffer.concat(chunks),{headers:{'content-type':request.headers.get('content-type') ?? ''}}).formData(); }
  catch {return Response.json({error:'Upload a PDF, PNG or JPEG.'},{status:400});}
  const file = form.get('file');
  if (!(file instanceof File)) return Response.json({error:'Choose a file.'},{status:400});
  const bytes = Buffer.from(await file.arrayBuffer());
  const error = validateContract(file.name,file.type,bytes);
  if (error) return Response.json({error},{status:400});
  const digest = createHash('sha256').update(bytes).digest('hex');
  const requestKey = request.headers.get('x-upload-key') ?? randomUUID();
  if (!/^[a-f0-9-]{36}$/i.test(requestKey)) return Response.json({error:'Choose the file again before uploading.'},{status:400});
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Vendor" WHERE id = ${vendorId} FOR UPDATE`;
    const previous = await tx.vendorContract.findFirst({where:{vendorId,OR:[{digest},{requestKey}]},select:{id:true,digest:true,deletedAt:true,requestKey:true}});
    if (previous) {
      if (previous.digest !== digest) return {error:'This upload key was already used for a different file.',status:409};
      if (previous.deletedAt) {
        if (previous.requestKey === requestKey) return {error:'This upload was removed. Choose the file again to restore it deliberately.',status:409};
        const count = await tx.vendorContract.count({where:{vendorId,deletedAt:null}});
        if (count >= 20) return {error:'This vendor already has 20 contracts. Remove one before uploading another.',status:400};
        await tx.vendorContract.update({where:{id:previous.id},data:{deletedAt:null,requestKey}});
        return {id:previous.id,status:200,restored:true};
      }
      return {id:previous.id,status:200,reused:true};
    }
    const count = await tx.vendorContract.count({where:{vendorId,deletedAt:null}});
    if (count >= 20) return {error:'This vendor already has 20 contracts. Remove one before uploading another.',status:400};
    const contract = await tx.vendorContract.create({data:{vendorId,name:safeContractName(file.name),contentType:file.type,size:bytes.length,content:bytes,digest,requestKey},select:{id:true}});
    return {id:contract.id,status:201};
  });
  return Response.json(result.error ? {error:result.error} : {id:result.id,reused:result.reused??false,restored:result.restored??false},{status:result.status,headers:{'Cache-Control':'private, no-store'}});
}
