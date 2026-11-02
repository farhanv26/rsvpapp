import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { beforeEach,afterEach,expect,it,vi } from 'vitest';
const router=vi.hoisted(()=>({push:vi.fn(),refresh:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>router}));
import { FinanceDialog } from '@/components/admin/finance/finance-dialog';
beforeEach(()=>{
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(){this.setAttribute('open','');}});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(){this.removeAttribute('open');}});
 vi.clearAllMocks();
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
function open(){render(<FinanceDialog label="Edit expense" title="Edit expense" operation="expense.save" weddingId="fixture" initial={{id:'expense',version:0}}><label>Amount<input name="agreed" aria-label="Amount" defaultValue="5500"/></label></FinanceDialog>);fireEvent.click(screen.getByRole('button',{name:'Edit expense'}));}
it('keeps entered values after failure and blocks double submits while a save is pending',async()=>{
 let finish!:(response:Response)=>void;const fetch=vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;}));vi.stubGlobal('fetch',fetch);
 open();const input=screen.getByRole('textbox',{name:'Amount'});fireEvent.input(input,{target:{value:'5800'}});const form=input.closest('form')!;
 fireEvent.submit(form);fireEvent.submit(form);expect(fetch).toHaveBeenCalledTimes(1);expect(screen.getByRole('button',{name:'Saving…'})).toBeDisabled();
 finish(Response.json({error:'Network save failed.'},{status:500}));await screen.findByRole('alert');expect(input).toHaveValue('5800');expect(screen.getByRole('button',{name:'Save changes'})).toBeEnabled();expect(router.refresh).not.toHaveBeenCalled();
});
it('asks before discarding a dirty task and closes only after a confirmed discard',async()=>{
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);open();fireEvent.input(screen.getByRole('textbox',{name:'Amount'}),{target:{value:'5800'}});
 fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(confirm).toHaveBeenCalled();expect(screen.getByRole('textbox',{name:'Amount'})).toHaveValue('5800');
 confirm.mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:'Cancel'}));await waitFor(()=>expect(screen.queryByRole('textbox',{name:'Amount'})).not.toBeInTheDocument());
});
it('refreshes the shared records only after a successful save',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({id:'expense',url:'/admin/budget/expense'})));
 open();fireEvent.click(screen.getByRole('button',{name:'Save changes'}));await waitFor(()=>expect(router.refresh).toHaveBeenCalledTimes(1));expect(screen.queryByRole('textbox',{name:'Amount'})).not.toBeInTheDocument();
});
