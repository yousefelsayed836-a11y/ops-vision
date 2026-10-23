"use client";
import {useState} from 'react';
import {useLocale,useTranslations} from 'next-intl';
import {api} from '@/lib/client';

function keyBytes(value:string){const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,char=>char.charCodeAt(0));}
export function EnablePush(){
 const t=useTranslations(),locale=useLocale();
 const [status,setStatus]=useState<'idle'|'enabled'|'blocked'|'unsupported'|'error'>(()=>{
  if(typeof window==='undefined')return 'idle';
  if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window))return 'unsupported';
  return Notification.permission==='denied'?'blocked':'idle';
 });
 const [busy,setBusy]=useState(false);
 async function enable(){setBusy(true);try{
  const permission=await Notification.requestPermission();if(permission!=='granted'){setStatus('blocked');return;}
  const registration=await navigator.serviceWorker.register('/dashboard-sw.js',{scope:`/${locale}/dashboard`});
  const {publicKey}=await api<{publicKey:string}>('push-key');
  const subscription=await registration.pushManager.getSubscription()??await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(publicKey)});
  const json=subscription.toJSON();await api('push-subscription','POST',{endpoint:subscription.endpoint,keys:json.keys});setStatus('enabled');
 }catch{setStatus('error');}finally{setBusy(false);}}
 if(status==='unsupported')return null;
 return <div className="push-permission"><span>{t('pushPermissionHelp')}</span>{status!=='enabled'&&status!=='blocked'&&<button type="button" className="button outline compact" disabled={busy} onClick={()=>void enable()}>{t('enableNotifications')}</button>}{status==='enabled'&&<small role="status">{t('notificationsEnabled')}</small>}{status==='blocked'&&<small role="status">{t('notificationsBlocked')}</small>}{status==='error'&&<small role="alert">{t('notificationsFailed')}</small>}</div>;
}
