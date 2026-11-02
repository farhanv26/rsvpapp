import { getCurrentAdminUserFromApi } from '@/lib/admin-api-auth';
import { sameOrigin } from '@/lib/vendor-contract-access';
import { FinanceError,mutateFinance } from '@/lib/finance-service';
import { logAuditActivity } from '@/lib/audit-log';
import { revalidatePath } from 'next/cache';
export async function POST(request:Request){
  if(!sameOrigin(request))return Response.json({error:'Request origin is not allowed.'},{status:403});
  const actor=await getCurrentAdminUserFromApi();
  if(!actor)return Response.json({error:'Sign in again to save.'},{status:401});
  try{
    let body;
    try{body=await request.json();}catch{return Response.json({error:'Invalid form data.'},{status:400});}
    if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Invalid form data.'},{status:400});
    const result=await mutateFinance(actor,body);
    await logAuditActivity({userId:actor.id,userName:actor.name,actionType:String(body.operation).replace('.','_'),entityType:'Wedding',entityId:String(body.weddingId),entityName:String(body.label??body.name??'Financial record'),message:`${actor.name} saved a financial record.`,metadata:{recordId:result.id,operation:String(body.operation)}});
    for(const path of ['/admin/budget','/admin/vendors','/admin/overview'])revalidatePath(path);
    revalidatePath('/admin/budget/[expenseId]','page');revalidatePath('/admin/vendors/[vendorId]','page');
    return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    if(error instanceof FinanceError)return Response.json({error:error.message},{status:error.status});
    return Response.json({error:'Could not save. Your entries are still here; try again.'},{status:500});
  }
}
