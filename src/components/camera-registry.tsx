"use client";
import {useState,type FormEvent} from 'react';
import {useLocale} from 'next-intl';
import {api} from '@/lib/client';
import type {Snapshot,Bay,Camera} from './types';

type Mapping={bayId:string;number:number};
function mapped(camera:Camera,group:Camera[],bays:Bay[]):Mapping[]{
 const zones=camera.zones as {bayMappings?:Mapping[]}|null;
 if(Array.isArray(zones?.bayMappings))return zones.bayMappings;
 const ids=[...new Set(group.map(item=>item.bayId).filter((id):id is string=>!!id))];
 return ids.map((bayId,index)=>({bayId,number:Number(bays.find(bay=>bay.id===bayId)?.name.match(/\d+/)?.[0])||index+1}));
}
function CameraCard({orgId,camera,group,bays,onRefresh}:{orgId:string;camera:Camera;group:Camera[];bays:Bay[];onRefresh:()=>Promise<void>}){
 const ar=useLocale()==='ar';
 const [chosen,setChosen]=useState<Record<string,number>>(()=>Object.fromEntries(mapped(camera,group,bays).map(item=>[item.bayId,item.number])));
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function save(event:FormEvent){event.preventDefault();setBusy(true);setMessage('');try{
  const assigned=Object.entries(chosen).map(([bayId,number])=>({bayId,number}));
  await api(`tenants/${orgId}/cameras/${camera.id}/bays`,'PATCH',{bays:assigned});await onRefresh();setMessage(ar?'تم حفظ ربط الأحواض':'Bay mapping saved');
 }catch{setMessage(ar?'تعذر حفظ الربط. تأكد من عدم تكرار رقم الحوض.':'Could not save. Check for duplicate bay numbers.');}finally{setBusy(false);}}
 async function removeIp(){if(!window.confirm(ar?'إزالة عنوان IP من الكاميرا؟':'Remove this camera IP?'))return;setBusy(true);setMessage('');try{await api(`tenants/${orgId}/cameras/${camera.id}`,'DELETE');await onRefresh();setMessage(ar?'تمت إزالة عنوان IP':'Camera IP removed');}catch{setMessage(ar?'تعذر إزالة عنوان IP':'Could not remove camera IP');}finally{setBusy(false);}}
 return <article className="panel camera-registry-card"><div className="section-title"><h3>{camera.name}</h3><strong dir="ltr">{camera.ipAddress}</strong><button type="button" className="text-button" disabled={busy} onClick={()=>void removeIp()}>{ar?'إزالة IP':'Remove IP'}</button></div><p>{ar?'الأحواض المختارة: ':'Selected bays: '}{Object.keys(chosen).length}</p><form onSubmit={e=>void save(e)}><div className="camera-bay-list">{bays.map(bay=><div className="camera-bay-option" key={bay.id}><label><input type="checkbox" checked={chosen[bay.id]!==undefined} onChange={event=>setChosen(previous=>{const next={...previous};if(event.target.checked)next[bay.id]=Math.max(1,...Object.values(previous).map(value=>value+1));else delete next[bay.id];return next;})}/> {bay.name}</label>{chosen[bay.id]!==undefined&&<label>{ar?'رقم الحوض':'Bay number'} <input aria-label={`${ar?'رقم':'Number'} ${bay.name}`} type="number" min="1" max="999" required value={chosen[bay.id]} onChange={event=>setChosen(previous=>({...previous,[bay.id]:Number(event.target.value)}))}/></label>}</div>)}</div><button className="button primary" disabled={busy}>{ar?'حفظ الأحواض':'Save bays'}</button>{message&&<p role="status">{message}</p>}</form></article>;
}
export function CameraRegistry({orgId,data,onRefresh}:{orgId:string;data:Snapshot;onRefresh:()=>Promise<void>}){
 const ar=useLocale()==='ar';const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const groups=new Map<string,Camera[]>();for(const camera of data.cameras.filter(item=>item.ipAddress)){const key=`${camera.branchId}:${camera.ipAddress}`;groups.set(key,[...(groups.get(key)??[]),camera]);}
 async function register(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;const values=new FormData(form);setBusy(true);setMessage('');try{
  const result=await api<{alreadyExists:boolean}>(`tenants/${orgId}/camera-register`,'POST',{branchId:values.get('branchId'),name:values.get('name'),ipAddress:values.get('ipAddress')});await onRefresh();if(!result.alreadyExists)form.reset();setMessage(result.alreadyExists?(ar?'الكاميرا مسجلة بالفعل؛ اختار أحواضها من القائمة.':'Camera already exists. Choose its bays below.'):(ar?'تمت إضافة الكاميرا. اختار أحواضها من القائمة.':'Camera added. Choose its bays below.'));
 }catch{setMessage(ar?'تعذر إضافة الكاميرا. راجع الـIP والفرع.':'Could not add camera. Check IP and branch.');}finally{setBusy(false);}}
 return <div className="camera-registry"><section className="panel"><h2>{ar?'إضافة كاميرات المغسلة':'Add wash cameras'}</h2><form className="form-fields" onSubmit={e=>void register(e)}><label className="field">{ar?'الفرع':'Branch'}<select name="branchId" required>{data.branches.map(branch=><option value={branch.id} key={branch.id}>{branch.name}</option>)}</select></label><label className="field">{ar?'اسم الكاميرا':'Camera name'}<input name="name" minLength={2} maxLength={120} placeholder={ar?'مثال: كاميرا المدخل':'Example: Entry camera'} required/></label><label className="field">IP<input name="ipAddress" dir="ltr" placeholder="192.168.1.10" required/></label><button className="button primary" disabled={busy||!data.branches.length}>{ar?'إضافة الكاميرا':'Add camera'}</button></form>{message&&<p role="status">{message}</p>}</section><div className="management-bays">{[...groups.values()].map(group=>{const camera=group.find(item=>(item.zones as {bayMappings?:unknown}|null)?.bayMappings!==undefined)??group[0];const bays=data.bays.filter(bay=>bay.branchId===camera.branchId);return <CameraCard key={`${camera.id}:${JSON.stringify(camera.zones)}`} orgId={orgId} camera={camera} group={group} bays={bays} onRefresh={onRefresh}/>;})}</div>{!groups.size&&<div className="panel">{ar?'لسه مفيش كاميرات. أضف عنوان IP الأول.':'No cameras yet. Add an IP address first.'}</div>}<div className="panel"><a href="/guides/opsvision-camera-ip-guide-ar.pdf" target="_blank" rel="noopener noreferrer">{ar?'دليل معرفة IP الكاميرا وربطها':'Camera IP and connection guide'}</a></div></div>;
}
