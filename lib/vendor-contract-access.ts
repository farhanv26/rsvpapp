import 'server-only';
import { getCurrentAdminUserFromApi } from '@/lib/admin-api-auth';
import { prisma } from '@/lib/prisma';
import { getWeddingAccess } from '@/lib/wedding-access';
export async function contractAccess(vendorId: string) {
  const actor = await getCurrentAdminUserFromApi();
  if (!actor) return null;
  const vendor = await prisma.vendor.findFirst({where:{id:vendorId, deletedAt:null}, select:{id:true,weddingId:true}});
  if (!vendor || (await getWeddingAccess(actor, vendor.weddingId)).status !== 'ok') return null;
  return vendor;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const target = new URL(request.url);
    const source = new URL(origin);
    // Next can normalize request.url to localhost; Host retains the browser's destination.
    const host = request.headers.get('host') ?? target.host;
    const protocol = request.headers.get('x-forwarded-proto') ?? target.protocol.slice(0, -1);
    return source.host === host && source.protocol === `${protocol}:`;
  } catch { return false; }
}
