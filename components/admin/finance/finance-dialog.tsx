'use client';
import { useEffect,useId,useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/admin/ui/dialog';

type Props={label:string;title:string;description?:string;operation:string;weddingId:string;initial?:Record<string,string|number|boolean|null>;children:React.ReactNode;submitLabel?:string;className?:string;navigate?:boolean};
export function FinanceDialog({label,title,description,operation,weddingId,initial={},children,submitLabel='Save changes',className='btn-secondary',navigate=false}:Props){
 const router=useRouter();const id=useId();const [open,setOpen]=useState(false);const [pending,setPending]=useState(false);const [error,setError]=useState('');
 const dirty=useRef(false);const busy=useRef(false);const key=useRef('');
 function close(){if(busy.current)return;if(dirty.current&&!confirm('Discard your unsaved changes?'))return;dirty.current=false;setOpen(false);}
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy.current)return;
  const data=Object.fromEntries(new FormData(event.currentTarget));
  busy.current=true;setPending(true);setError('');
  try{
   const response=await fetch('/admin/api/finance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...initial,...data,operation,weddingId,requestKey:key.current})});
   const result=await response.json();
   if(!response.ok){setError(result.error??'Could not save. Try again.');return;}
   dirty.current=false;setOpen(false);
   if(typeof BroadcastChannel!=='undefined'){const channel=new BroadcastChannel('vowpal-finance');channel.postMessage(weddingId);channel.close();}
   if(navigate&&result.url)router.push(result.url);router.refresh();
  }catch{setError('Could not save. Your entries are still here. Check your connection and try again.');}
  finally{busy.current=false;setPending(false);}
 }
 return <>
  <button type="button" className={className} onClick={()=>{key.current=crypto.randomUUID();setError('');dirty.current=false;setOpen(true);}}>{label}</button>
  <Dialog open={open} onClose={close} title={title} description={description} size="sm" dismissible={!pending} footer={<><button type="button" className="btn-ghost" disabled={pending} onClick={close}>Cancel</button><button type="submit" form={id} className="btn-primary" disabled={pending}>{pending?'Saving…':submitLabel}</button></>}>
   <form id={id} onSubmit={submit} onInput={()=>{dirty.current=true;}} aria-busy={pending} className="finance-form">
    <fieldset disabled={pending} className="min-w-0 space-y-4">{children}
     {error.toLowerCase().includes('overpayment')?<label className="flex items-start gap-2 rounded-lg bg-[var(--warning-soft)] p-3 text-sm"><input type="checkbox" name="confirmOverpayment" className="mt-1" required />I have reviewed the amounts and want to keep this overpayment.</label>:null}
     {error.includes('similar expense')?<label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmDuplicate" className="mt-1" required />This is a separate expense. Keep both records.</label>:null}
    </fieldset>
    {error?<div className="mt-4" role="alert"><p className="notice-error">{error}</p>{error.includes('changed')?<button type="button" className="text-link mt-2 text-sm" onClick={()=>router.refresh()}>Refresh latest amounts</button>:null}</div>:null}
   </form>
  </Dialog>
 </>;
}
export function ExpenseLinkFields({expenses}:{expenses:{id:string;label:string;version:number}[]}){
 const [selected,setSelected]=useState(expenses[0]?.id??'');
 return <><label className="form-label">Existing expense<select name="id" value={selected} onChange={e=>setSelected(e.target.value)} className="input-luxe" required>{expenses.map(e=><option key={e.id} value={e.id}>{e.label}</option>)}</select></label><input type="hidden" name="version" value={expenses.find(e=>e.id===selected)?.version??0} /></>;
}
export function FinanceLive({weddingId}:{weddingId:string}){
 const router=useRouter();
 useEffect(()=>{const channel=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel('vowpal-finance');if(channel)channel.onmessage=e=>{if(e.data===weddingId)router.refresh();};const refresh=()=>router.refresh();window.addEventListener('focus',refresh);return()=>{channel?.close();window.removeEventListener('focus',refresh);};},[router,weddingId]);
 return null;
}
