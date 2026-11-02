// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { safeContractName, validateContract, CONTRACT_MAX_BYTES } from '@/lib/vendor-contract-validation';
const mocks=vi.hoisted(()=>({actor:vi.fn(),access:vi.fn(),vendor:vi.fn(),find:vi.fn(),create:vi.fn(),remove:vi.fn(),count:vi.fn(),transaction:vi.fn(),lock:vi.fn(),update:vi.fn()}));
vi.mock('@/lib/admin-api-auth',()=>({getCurrentAdminUserFromApi:mocks.actor}));
vi.mock('@/lib/wedding-access',()=>({getWeddingAccess:mocks.access}));
vi.mock('@/lib/prisma',()=>({prisma:{vendor:{findFirst:mocks.vendor},vendorContract:{findFirst:mocks.find,create:mocks.create,updateMany:mocks.remove,count:mocks.count},$transaction:mocks.transaction}}));
import { sameOrigin } from '@/lib/vendor-contract-access';
import { POST } from '@/app/admin/api/vendors/[vendorId]/contracts/route';
import { GET, DELETE } from '@/app/admin/api/vendors/[vendorId]/contracts/[contractId]/route';
const url='http://localhost/admin/api/vendors/vendor-a/contracts';
const ctx={params:Promise.resolve({vendorId:'vendor-a',contractId:'contract-a'})};
const pdf=Buffer.from('%PDF-1.7\nfictional contract');
function upload(bytes:Uint8Array=pdf,name='agreement.pdf',type='application/pdf',origin='http://localhost') {
 const form=new FormData();form.set('file',new File([new Uint8Array(bytes)],name,{type}));
 return new Request(url,{method:'POST',headers:{origin},body:form});
}
beforeEach(()=>{vi.resetAllMocks();mocks.actor.mockResolvedValue({id:'a',role:'event_creator'});mocks.access.mockResolvedValue({status:'ok'});mocks.vendor.mockResolvedValue({id:'vendor-a',weddingId:'wedding-a'});mocks.count.mockResolvedValue(0);mocks.create.mockResolvedValue({id:'new'});mocks.transaction.mockImplementation(async fn=>fn({$queryRaw:mocks.lock,vendorContract:{findFirst:mocks.find,count:mocks.count,create:mocks.create,update:mocks.update}}));});
describe('private contracts',()=>{
 it('checks the browser Host when Next normalizes its internal request URL',()=>{expect(sameOrigin(new Request('http://localhost:3001/upload',{headers:{host:'127.0.0.1:3001',origin:'http://127.0.0.1:3001'}}))).toBe(true);expect(sameOrigin(new Request('http://localhost:3001/upload',{headers:{host:'127.0.0.1:3001',origin:'https://attacker.test'}}))).toBe(false);});
 it('rejects anonymous upload and download without loading content',async()=>{mocks.actor.mockResolvedValue(null);expect((await POST(upload(),ctx)).status).toBe(404);expect((await GET(new Request(url),ctx)).status).toBe(404);expect(mocks.find).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled();});
 it('rejects cross-wedding members',async()=>{mocks.access.mockResolvedValue({status:'forbidden'});expect((await POST(upload(),ctx)).status).toBe(404);expect((await GET(new Request(url),ctx)).status).toBe(404);expect(mocks.find).not.toHaveBeenCalled();});
 it('rejects cross-origin upload and removal',async()=>{expect((await POST(upload(pdf,'a.pdf','application/pdf','https://attacker.test'),ctx)).status).toBe(403);expect((await DELETE(new Request(url,{method:'DELETE',headers:{origin:'https://attacker.test'}}),ctx)).status).toBe(403);expect(mocks.remove).not.toHaveBeenCalled();});
 it('stores validated files without public URLs',async()=>{expect((await POST(upload(),ctx)).status).toBe(201);expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({vendorId:'vendor-a',content:pdf,size:pdf.length})}));});
 it('rejects disguised HTML and empty files',async()=>{expect((await POST(upload(Buffer.from('<html>bad</html>')),ctx)).status).toBe(400);expect(validateContract('a.pdf','application/pdf',new Uint8Array())).toBeTruthy();expect(mocks.create).not.toHaveBeenCalled();});
 it('rejects oversized files even without content length',async()=>{expect((await POST(new Request(url,{method:'POST',headers:{origin:'http://localhost'},body:new Uint8Array(CONTRACT_MAX_BYTES+65537)}),ctx)).status).toBe(413);expect(mocks.create).not.toHaveBeenCalled();});
 it('scopes downloads to the parent vendor and disables caching/sniffing',async()=>{mocks.find.mockResolvedValue({name:'a.pdf',content:pdf,contentType:'application/pdf',size:pdf.length});const response=await GET(new Request(url),ctx);expect(response.headers.get('cache-control')).toBe('private, no-store');expect(response.headers.get('x-content-type-options')).toBe('nosniff');expect(response.headers.get('content-disposition')).toContain('attachment');expect(mocks.find).toHaveBeenCalledWith({where:{id:'contract-a',vendorId:'vendor-a',deletedAt:null}});});
 it('soft-deletes only an active contract under this vendor',async()=>{mocks.remove.mockResolvedValue({count:1});expect((await DELETE(new Request(url,{method:'DELETE',headers:{origin:'http://localhost'}}),ctx)).status).toBe(204);expect(mocks.remove).toHaveBeenCalledWith({where:{id:'contract-a',vendorId:'vendor-a',deletedAt:null},data:{deletedAt:expect.any(Date)}});});
 it('sanitizes names and requires matching extension and magic',()=>{expect(safeContractName('../../a\r\n".pdf')).toBe('a___.pdf');expect(validateContract('a.png','image/png',pdf)).toBeTruthy();expect(validateContract('a.svg','image/svg+xml',pdf)).toBeTruthy();});
});
