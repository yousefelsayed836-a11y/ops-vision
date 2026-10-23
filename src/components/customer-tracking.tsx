"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {useLocale,useTranslations} from 'next-intl';
import QRCode from 'qrcode';
import Image from 'next/image';
import {api} from '@/lib/client';
import {Logo} from './logo';
import {saudiDate,saudiTime} from '@/lib/saudi-time';
export type TrackingCredential={url:string;password:string;expiresAt:string};
export function TrackingDialog({value,onClose}:{value:TrackingCredential;onClose:()=>void}){
 const t=useTranslations('tracking'),locale=useLocale(),ref=useRef<HTMLDialogElement>(null),[qr,setQr]=useState('');
 useEffect(()=>{ref.current?.showModal();void QRCode.toDataURL(value.url,{width:220,margin:1}).then(setQr);},[value.url]);
 return <dialog ref={ref} className="form-dialog invitation-dialog" onCancel={onClose}><h2>{t('access')}</h2><p>{t('once')}</p>{qr&&<Image unoptimized src={qr} alt="QR" width={220} height={220}/>}
 <label className="field">{t('link')}<input readOnly value={value.url} dir="ltr"/></label><label className="field">{t('password')}<input readOnly value={value.password} dir="ltr"/></label><p>{t('expires')}: {saudiDate(value.expiresAt,locale)}</p>
 <button className="button primary" onClick={()=>void navigator.clipboard.writeText(`${value.url}\n${value.password}`)}>{t('copy')}</button><button className="button outline" onClick={onClose}>{t('close')}</button></dialog>;
}
type Status={customerName?:string|null;organization:string;branch:string;status:string;serviceAr:string;serviceEn:string;startedAt:string|null;completedAt:string|null;history:{toStatus:string;createdAt:string}[]};
export function TrackingPortal({id}:{id:string}){
 const t=useTranslations('tracking'),state=useTranslations('states'),locale=useLocale(),[record,setRecord]=useState<Status|null>(null),[error,setError]=useState(false),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;async function load(){try{const result=await api<Status>(`tracking/${id}`);if(active)setRecord(result);}catch{if(active)setRecord(null);}}const initial=setTimeout(()=>void load(),0),timer=setInterval(()=>void load(),10000);return()=>{active=false;clearTimeout(initial);clearInterval(timer);};},[id]);
 async function login(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError(false);try{await api(`tracking/${id}/login`,'POST',Object.fromEntries(new FormData(e.currentTarget)));setRecord(await api<Status>(`tracking/${id}`));}catch{setError(true);}finally{setBusy(false);}}
 return <div className="public-root"><header className="public-header"><Logo variant="pink"/></header><main className="tracking-main"><section className="panel"><h1>{t('title')}</h1>{record?<><h2>{record.organization}</h2>{record.customerName&&<p>{record.customerName}</p>}<p>{record.branch}</p><h2>{state(record.status)}</h2><p>{locale==='ar'?record.serviceAr:record.serviceEn}</p><ol>{record.history.map((entry,i)=><li key={i}>{state(entry.toStatus)} · {saudiTime(entry.createdAt,locale)}</li>)}</ol></>:<form onSubmit={login}><label className="field">{t('password')}<input name="password" type="password" autoComplete="current-password" required maxLength={128}/></label><button className="button primary" disabled={busy}>{t('enter')}</button>{error&&<p role="alert">{t('error')}</p>}</form>}</section></main><footer className="public-footer"><Logo variant="pink"/></footer></div>;
}
