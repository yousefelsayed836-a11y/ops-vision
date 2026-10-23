"use client";
import {useEffect,useState} from 'react';
import {useLocale,useTranslations} from 'next-intl';
import Image from 'next/image';
import QRCode from 'qrcode';
import {api} from '@/lib/client';
import {vehicleCategoryLabel} from '@/lib/catalog';
import {Logo} from './logo';
import {WashActivity} from './wash-activity';
import {saudiTime} from '@/lib/saudi-time';

type Bay={id:string;name:string;branch:string};
type Directory={organization:string;notice:string;vehicleCategories:{code:string;nameAr:string;nameEn:string}[];bays:Bay[]};
type BayStatus={organization:string;branch:string;bay:string;status:string;wash:null|{status:string;serviceAr:string;serviceEn:string;startedAt:string|null;estimatedMinutes:number;timeAdjustmentSeconds:number;category:string;extraServices:{nameAr:string;nameEn:string}[]}};
const carImage:Record<string,string>={SEDAN:'/assets/sedan.webp',SUV:'/assets/suv.webp',FULL_SIZE_SUV:'/assets/4x4.webp',MOTORCYCLE:'/assets/motorcycle.png',BICYCLE:'/assets/bicycle.png'};

export function FixedWashLink({slug}:{slug:string}){
 const t=useTranslations('publicWash'),locale=useLocale(),[origin,setOrigin]=useState(''),[qr,setQr]=useState('');
 const url=origin?`${origin}/${locale}/track?wash=${encodeURIComponent(slug)}`:'';
 useEffect(()=>{const timer=setTimeout(()=>setOrigin(window.location.origin),0);return()=>clearTimeout(timer);},[]);
 useEffect(()=>{if(!url)return;void QRCode.toDataURL(url,{width:220,margin:1}).then(setQr);},[url]);
 return <section className="panel fixed-wash-link"><h2>{t('shareTitle')}</h2><p>{t('shareHelp')}</p>{qr&&<Image unoptimized src={qr} width={180} height={180} alt={t('qrAlt')}/>}<label className="field">{t('link')}<input readOnly dir="ltr" value={url}/></label><button type="button" className="button outline" disabled={!url} onClick={()=>void navigator.clipboard.writeText(url)}>{t('copy')}</button></section>;
}

export function PublicWashPortal({slug}:{slug:string}){
 const t=useTranslations('publicWash'),states=useTranslations('states'),locale=useLocale();
 const [directory,setDirectory]=useState<Directory|null>(null),[selected,setSelected]=useState(''),[detail,setDetail]=useState<BayStatus|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;void api<Directory>(`public-wash/${slug}`).then(result=>{if(active)setDirectory(result);}).catch(()=>{if(active)setError(t('unavailable'));});return()=>{active=false;};},[slug,t]);
 useEffect(()=>{if(!selected)return;let active=true;const load=async()=>{try{const result=await api<BayStatus>(`public-wash/${slug}/bays/${selected}`);if(active){setDetail(result);setError('');}}catch{if(active){setDetail(null);setError(t('unavailable'));}}};const initial=setTimeout(()=>void load(),0),timer=setInterval(()=>void load(),10000);return()=>{active=false;clearTimeout(initial);clearInterval(timer);};},[selected,slug,t]);
 const wash=detail?.wash;
 return <div className="public-root"><header className="public-header"><Logo variant="pink"/></header><main className="tracking-main"><section className="panel public-wash-card"><h1>{directory?.organization??t('title')}</h1><p>{t('intro')}</p>{directory?.notice&&<p className='public-wash-notice'>{directory.notice}</p>}<label className="field">{t('chooseBay')}<select value={selected} onChange={event=>{setSelected(event.target.value);setDetail(null);}}><option value="">{t('bayPlaceholder')}</option>{directory?.bays.map(bay=><option key={bay.id} value={bay.id}>{bay.branch} · {bay.name}</option>)}</select></label>{error&&<p role="alert" className="error-text">{error}</p>}{selected&&detail&&<div className="public-bay-result"><h2>{detail.branch} · {detail.bay}</h2>{wash?<><p className="public-wash-state">{states(wash.status)}</p>{carImage[wash.category]&&<Image className="public-car-image" src={carImage[wash.category]} alt={vehicleCategoryLabel(wash.category,locale,directory?.vehicleCategories)} width={720} height={410}/>}<p>{t('vehicle')}: {vehicleCategoryLabel(wash.category,locale,directory?.vehicleCategories)}</p><p>{t('service')}: {locale==='ar'?wash.serviceAr:wash.serviceEn}</p>{wash.extraServices.map((service,index)=><p key={index}>{t('service')}: {locale==='ar'?service.nameAr:service.nameEn}</p>)}{wash.startedAt&&<p>{t('started')}: {saudiTime(wash.startedAt,locale)}</p>}<WashActivity washId={selected} orgId="" startedAt={wash.startedAt} status={wash.status} estimatedMinutes={wash.estimatedMinutes} timeAdjustmentSeconds={wash.timeAdjustmentSeconds}/></>:<p className="public-wash-state">{detail.status==='AVAILABLE'?t('available'):t('notActive')}</p>}</div>}{selected&&!detail&&!error&&<p>{t('loading')}</p>}</section></main><footer className="public-footer"><Logo variant="pink"/></footer></div>;
}


