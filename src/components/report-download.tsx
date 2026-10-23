"use client";
import {useState} from 'react';
import {useTranslations} from 'next-intl';

function saudiToday(){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const part=(type:string)=>parts.find(item=>item.type===type)!.value;return `${part('year')}-${part('month')}-${part('day')}`;}
export function ReportDownload({orgId}:{orgId?:string}){
 const t=useTranslations();
 const [from,setFrom]=useState(saudiToday);
 const [to,setTo]=useState(saudiToday);
 const valid=!!from&&!!to&&from<=to;
 const href=`/api/v1/report-pdf?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${orgId?`&orgId=${encodeURIComponent(orgId)}`:''}`;
 return <section className="panel report-download"><h2>{t('downloadReportPdf')}</h2><div className="button-row"><label className="field">{t('fromDate')}<input type="date" value={from} max={to} onChange={event=>setFrom(event.target.value)}/></label><label className="field">{t('toDate')}<input type="date" value={to} min={from} onChange={event=>setTo(event.target.value)}/></label>{valid&&<a className="button primary" href={href} download>{t('downloadPdf')}</a>}</div></section>;
}
