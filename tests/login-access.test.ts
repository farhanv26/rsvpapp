// @vitest-environment node
import { randomBytes } from 'node:crypto';
import { hash } from 'bcryptjs';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({findMany:vi.fn(),set:vi.fn(),token:vi.fn()}));
vi.mock('@/lib/prisma',()=>({prisma:{user:{findMany:mocks.findMany}}}));
vi.mock('next/headers',()=>({cookies:async()=>({set:mocks.set})}));
vi.mock('next/navigation',()=>({redirect:(path:string)=>{throw new Error(`REDIRECT:${path}`);}}));
vi.mock('@/lib/admin-session',()=>({COOKIE_NAME:'admin_session',createAdminSessionToken:mocks.token}));
import { authenticateAdminCredentials } from '@/lib/login-credentials';
import { loginAdminAction } from '@/app/admin/login/actions';
const password=randomBytes(24).toString('base64url');
let account:{id:string;name:string;role:string;passwordHash:string};
beforeEach(async()=>{vi.clearAllMocks();account={id:'synthetic-auth-account',name:'Farhan',role:'super_admin',passwordHash:await hash(password,4)};mocks.findMany.mockResolvedValue([account]);mocks.token.mockResolvedValue('synthetic-session');});
it('normalizes only the account identifier and verifies a real bcrypt hash',async()=>{
 expect(await authenticateAdminCredentials('  fArHaN  ',password)).toEqual({id:account.id,name:'Farhan',role:'super_admin'});
 expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{name:{equals:'fArHaN',mode:'insensitive'},active:true,deletedAt:null},take:2}));
 expect(await authenticateAdminCredentials('Farhan',` ${password}`)).toBeNull();
});
it('rejects absent, inactive/deleted-filtered, placeholder and ambiguous identities',async()=>{
 mocks.findMany.mockResolvedValue([]);expect(await authenticateAdminCredentials('Farhan',password)).toBeNull();
 mocks.findMany.mockResolvedValue([{...account,passwordHash:'placeholder_hash'}]);expect(await authenticateAdminCredentials('Farhan',password)).toBeNull();
 mocks.findMany.mockResolvedValue([account,{...account,id:'other'}]);expect(await authenticateAdminCredentials('Farhan',password)).toBeNull();
});
it('sets a session and redirects only after password authentication',async()=>{
 const form=new FormData();form.set('adminUser','  farhan ');form.set('password',password);
 await expect(loginAdminAction(form)).rejects.toThrow('REDIRECT:/admin/overview');
 expect(mocks.token).toHaveBeenCalledWith({userId:account.id,name:'Farhan',userRole:'super_admin'});
 expect(mocks.set).toHaveBeenCalledWith('admin_session','synthetic-session',expect.objectContaining({httpOnly:true,sameSite:'lax',path:'/'}));
});
it('returns a generic error without a cookie for wrong credentials',async()=>{
 const form=new FormData();form.set('adminUser','Farhan');form.set('password',randomBytes(24).toString('base64url'));
 await expect(loginAdminAction(form)).rejects.toThrow('REDIRECT:/admin/login?error=invalid');expect(mocks.set).not.toHaveBeenCalled();
});
