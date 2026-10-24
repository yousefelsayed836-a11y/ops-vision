"use client";
import {useEffect,useState,type FormEvent} from 'react';
import {useTranslations} from 'next-intl';
import {api} from '@/lib/client';

export function WashActivity({washId,orgId,startedAt,completedAt,history=[],status,estimatedMinutes,timeAdjustmentSeconds=0,canAdjust=false,canComment=false,platform=false,onChanged}:{washId:string;orgId:string;startedAt:string|null;history?:{toStatus:string;createdAt:string}[];completedAt?:string|null;status:string;estimatedMinutes:number;timeAdjustmentSeconds?:number;canAdjust?:boolean;canComment?:boolean;platform?:boolean;onChanged?:()=>void|Promise<void>}){
 const t=useTranslations('washActivity');
 const [now,setNow]=useState(0),[busy,setBusy]=useState(false),[comment,setComment]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{const update=()=>setNow(Date.now());update();const timer=setInterval(update,1000);return()=>clearInterval(timer);},[]);
 const stopped=['COMPLETED','DELIVERED','CANCELLED'].includes(status);
 const end=completedAt&&stopped?Date.parse(completedAt):now;
 const seconds=startedAt&&end?Math.max(0,Math.floor((end-Date.parse(startedAt))/1000)):0;
 let pausedMs=0;let pausedAt:number|null=null;for(const event of history){const at=Date.parse(event.createdAt);if(event.toStatus==='PAUSED'&&pausedAt===null)pausedAt=at;else if(pausedAt!==null){pausedMs+=Math.max(0,at-pausedAt);pausedAt=null;}}if(pausedAt!==null)pausedMs+=Math.max(0,end-pausedAt);
 const activeSeconds=Math.max(0,seconds-Math.floor(pausedMs/1000));
 const adjustedSeconds=Math.max(0,activeSeconds+timeAdjustmentSeconds);
 const format=(value:number)=>`${Math.floor(value/60).toString().padStart(2,'0')}:${(value%60).toString().padStart(2,'0')}`;
 const totalSeconds=estimatedMinutes*60;
 const steps=[10,60];
 async function change(deltaSeconds:number){setBusy(true);setMessage('');try{await api(platform?`platform/washes/${washId}/time`:`tenants/${orgId}/washes/${washId}/time`,'POST',{...(platform?{orgId}:{}),deltaSeconds});await onChanged?.();}catch{setMessage(t('saveError'));}finally{setBusy(false);}}
 async function send(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setMessage('');try{await api(`tenants/${orgId}/washes/${washId}/comments`,'POST',{comment});setComment('');setMessage(t('commentSent'));}catch{setMessage(t('saveError'));}finally{setBusy(false);}}
 const remainingSeconds=Math.max(0,totalSeconds-seconds);
 const overdue=!stopped&&startedAt&&adjustedSeconds>=estimatedMinutes*60;
 return <div className={`wash-activity${overdue?" wash-overdue":""}`}><div className="wash-activity-time"><div><small>{t('elapsed')}</small><strong dir="ltr">{startedAt?format(adjustedSeconds):'00:00'}</strong></div><div><small>{'المدة المتوقعة'}</small><strong dir="ltr">{format(totalSeconds)}</strong>{canAdjust&&!stopped&&<form onSubmit={async e=>{e.preventDefault();setBusy(true);try{const minutes=Number(new FormData(e.currentTarget).get('minutes'));await api(platform?`platform/washes/${washId}/time`:`tenants/${orgId}/washes/${washId}/time`,'POST',{...(platform?{orgId}:{}),estimatedMinutes:minutes});await onChanged?.();}catch{setMessage(t('saveError'));}finally{setBusy(false);}}}><input aria-label={t('estimated')} name="minutes" type="number" min="1" max="1440" defaultValue={estimatedMinutes} key={estimatedMinutes} style={{width:80}} required/><button type="submit" className="button outline compact" disabled={busy}>✓</button></form>}</div></div>
  {canAdjust&&!stopped&&<><div className="wash-time-controls">{steps.map(step=><div className="button-row" key={step}><button type="button" className="button outline compact" disabled={busy||adjustedSeconds-step<0} onClick={()=>void change(-step)}>{t('minus')} {step===10?t('tenSeconds'):step===30?t('halfMinute'):t('oneMinute')}</button><button type="button" className="button outline compact" disabled={busy||adjustedSeconds+step>86400} onClick={()=>void change(step)}>{t('plus')} {step===10?t('tenSeconds'):step===30?t('halfMinute'):t('oneMinute')}</button></div>)}</div></>}
  {canComment&&<form className="wash-activity-comment" onSubmit={send}><label className="field">{t('comment')}<textarea value={comment} onChange={event=>setComment(event.target.value)} minLength={2} maxLength={500} rows={2} required/></label><button className="button outline compact" disabled={busy}>{t('send')}</button></form>}
  {message&&<small role="status">{message}</small>}</div>;
}



