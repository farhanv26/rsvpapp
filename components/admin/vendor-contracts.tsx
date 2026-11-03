'use client';
import { useEffect,useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download,Eye,FileText,Upload } from 'lucide-react';
import { Dialog } from '@/components/admin/ui/dialog';
import { CONTRACT_MAX_BYTES } from '@/lib/contract-limits';
type Contract={id:string;name:string;size:number;createdAt:string;contentType?:string};
export function UploadContractLauncher({vendorId}:{vendorId:string}){
 return <button type="button" className="btn-secondary" onClick={()=>window.dispatchEvent(new CustomEvent('vowpal-upload-contract',{detail:vendorId}))}><Upload className="h-4 w-4" aria-hidden/>Upload contract</button>;
}
export function VendorContracts({vendorId,contracts}:{vendorId:string;contracts:Contract[]}){
 const router=useRouter();const input=useRef<HTMLInputElement>(null);const busy=useRef(false);const key=useRef('');
 const [open,setOpen]=useState(false);const [file,setFile]=useState<File|null>(null);const [pending,setPending]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [removing,setRemoving]=useState<string|null>(null);
 const base=`/admin/api/vendors/${encodeURIComponent(vendorId)}/contracts`;
 useEffect(()=>{const launch=(event:Event)=>{if((event as CustomEvent).detail===vendorId)setOpen(true);};window.addEventListener('vowpal-upload-contract',launch);return()=>window.removeEventListener('vowpal-upload-contract',launch);},[vendorId]);
 function choose(next:File|undefined){setFile(next??null);setError('');key.current=crypto.randomUUID();}
 function close(){if(busy.current)return;if(file&&!confirm('Discard the selected file?'))return;setOpen(false);setFile(null);setError('');}
 async function upload(event:React.FormEvent){
  event.preventDefault();if(busy.current)return;
  if(!file){setError('Choose a contract first.');return;}
  if(file.size>CONTRACT_MAX_BYTES||!file.size){setError('Choose a non-empty file up to 10 MB.');return;}
  busy.current=true;setPending(true);setError('');
  try{
   const body=new FormData();body.set('file',file);
   const response=await fetch(base,{method:'POST',headers:{'X-Upload-Key':key.current},body});const data=await response.json();
   if(!response.ok){setError(data.error??'Upload failed. Try again.');return;}
   setFile(null);setOpen(false);setNotice(data.reused?'This contract is already saved.':data.restored?'Contract restored.':'Contract uploaded.');router.refresh();
  }catch{setError('Upload failed. Your selected file is still here. Check your connection and retry.');}
  finally{busy.current=false;setPending(false);}
 }
 async function remove(id:string){
  if(busy.current)return;busy.current=true;setPending(true);
  try{const response=await fetch(`${base}/${id}`,{method:'DELETE'});if(!response.ok)throw new Error();setRemoving(null);setNotice('Contract removed.');router.refresh();}catch{setNotice('Could not remove this contract. Try again.');}finally{busy.current=false;setPending(false);}
 }
 return <section id="contracts" className="scroll-mt-6" aria-labelledby="contracts-heading"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 id="contracts-heading" className="section-heading">Contracts</h2><button type="button" className="btn-secondary btn-sm" onClick={()=>setOpen(true)}><Upload className="h-4 w-4" aria-hidden/>Upload contract</button></div>
  {notice?<p className="notice-info mb-3" role="status">{notice}</p>:null}
  {contracts.length?<ul className="divide-y divide-[var(--border-soft)] border-y border-[var(--border-soft)]">{contracts.map(c=><li key={c.id} className="py-4"><div className="flex items-start gap-3"><FileText className="mt-1 h-4 w-4 shrink-0 text-[var(--muted-text)]" aria-hidden/><div className="min-w-0 flex-1"><p className="break-all text-sm font-medium">{c.name}</p><p className="mt-1 text-xs text-[var(--muted-text)]">{c.size>=1024*1024?`${(c.size/1024/1024).toFixed(1)} MB`:`${Math.ceil(c.size/1024)} KB`} · {new Intl.DateTimeFormat('en-CA',{dateStyle:'medium'}).format(new Date(c.createdAt))}</p><div className="mt-2 flex flex-wrap gap-1"><a href={`${base}/${c.id}?preview=1`} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm" aria-label={`Preview ${c.name} in a new tab`}><Eye className="h-4 w-4" aria-hidden/>Preview</a><a href={`${base}/${c.id}`} className="btn-ghost btn-sm" aria-label={`Download ${c.name}`}><Download className="h-4 w-4" aria-hidden/>Download</a><button type="button" className="btn-ghost btn-sm text-[var(--danger)]" disabled={pending} onClick={()=>setRemoving(c.id)}>Remove</button></div></div></div>{removing===c.id?<div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-[var(--surface-muted)] p-3"><p className="w-full text-sm">Remove this contract from the vendor?</p><button type="button" className="btn-danger btn-sm" disabled={pending} onClick={()=>remove(c.id)}>Remove contract</button><button type="button" className="btn-ghost btn-sm" disabled={pending} onClick={()=>setRemoving(null)}>Keep contract</button></div>:null}</li>)}</ul>:<p className="border-y border-[var(--border-soft)] py-6 text-sm text-[var(--muted-text)]">No contracts yet. Keep signed agreements and supporting files here.</p>}
  <p className="mt-3 text-xs leading-relaxed text-[var(--muted-text)]">Private to this wedding’s members and platform administrators.</p>
  <Dialog open={open} onClose={close} title="Upload contract" description="PDF, JPG or PNG · up to 10 MB" size="sm" dismissible={!pending} footer={<><button type="button" className="btn-ghost" disabled={pending} onClick={close}>Cancel</button><button type="submit" form={`upload-${vendorId}`} className="btn-primary" disabled={pending||!file}>{pending?'Uploading…':error?'Retry upload':'Upload contract'}</button></>}>
   <form id={`upload-${vendorId}`} onSubmit={upload} aria-busy={pending}><div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy.current)choose(e.dataTransfer.files[0]);}} className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--background)] p-5"><label className="form-label">Choose a file<input ref={input} type="file" accept="application/pdf,image/jpeg,image/png" disabled={pending} onChange={e=>choose(e.target.files?.[0])} className="input-luxe mt-3 file:mr-3 file:rounded file:border-0 file:bg-[var(--surface-muted)] file:px-2 file:py-1"/></label><p className="mt-3 text-sm text-[var(--muted-text)]">You can also drop a file here.</p>{file?<p className="mt-4 break-all text-sm font-medium">{file.name}<span className="mt-1 block text-xs font-normal text-[var(--muted-text)]">{(file.size/1024/1024).toFixed(2)} MB</span></p>:null}</div>{error?<p role="alert" className="notice-error mt-4">{error}</p>:null}</form>
  </Dialog>
 </section>;
}
