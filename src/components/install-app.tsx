"use client";
import {useEffect,useState} from 'react';
import {useLocale,useTranslations} from 'next-intl';
type InstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};
export function InstallApp({active}:{active:boolean}){
 const t=useTranslations(),locale=useLocale();
 const [prompt,setPrompt]=useState<InstallPrompt|null>(null),[selected,setSelected]=useState(''),[installed,setInstalled]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
 useEffect(()=>{
  const media=window.matchMedia('(display-mode: standalone)');
  const sync=()=>setInstalled(media.matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone));
  const handler=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPrompt);};
  const complete=()=>{setInstalled(true);setPrompt(null);setStatus('installed');};
  sync();window.addEventListener('beforeinstallprompt',handler);window.addEventListener('appinstalled',complete);media.addEventListener('change',sync);
  if('serviceWorker'in navigator)void navigator.serviceWorker.register('/dashboard-sw.js',{scope:`/${locale}/dashboard`}).catch(()=>setStatus('unavailable'));
  return()=>{window.removeEventListener('beforeinstallprompt',handler);window.removeEventListener('appinstalled',complete);media.removeEventListener('change',sync);};
 },[locale]);
 async function install(device:string){
  setSelected(device);setStatus('');
  if(installed){setStatus('installed');return;}
  if(device==='iphone'||!prompt){setStatus('manual');return;}
  setBusy(true);try{await prompt.prompt();const choice=await prompt.userChoice;setPrompt(null);setStatus(choice.outcome==='accepted'?'accepted':'dismissed');}catch{setPrompt(null);setStatus('unavailable');}finally{setBusy(false);}
 }
 return <section className="panel" hidden={!active}><h2>{t('installApp')}</h2>
  <p className="muted">{t('installFeedback.hint')}</p>
  <div className="install-options">{['iphone','android','windows','mac'].map(device=><article key={device}><h3>{t(`devices.${device}`)}</h3><button type="button" className="button primary" disabled={busy} onClick={()=>void install(device)}>{t(installed?'installFeedback.installed':device==='iphone'?'addHomeScreen':'install')}</button></article>)}</div>
  {selected&&<div className="install-help" role="status"><h3>{t(`devices.${selected}`)}</h3>{status&&<p>{t(`installFeedback.${status}`)}</p>}{!installed&&status!=='accepted'&&<p>{t(`installSteps.${selected}`)}</p>}<a className="text-button" href={`/${locale}/dashboard`}>{t('openDashboard')}</a></div>}
  <small>{t('installFeedback.remote')}</small>
 </section>;
}
