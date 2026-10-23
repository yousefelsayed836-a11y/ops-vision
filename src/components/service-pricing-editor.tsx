"use client";

import {useState,type FormEvent} from 'react';
import {useLocale,useTranslations} from 'next-intl';
import {vehicleCategories,vehicleCategoryLabel} from '@/lib/catalog';
import type {VehicleCategoryOption} from './vehicle-category-picker';

type Rule={category:string;size:string;price:string;durationMinutes?:number|null};
export function ServicePricingEditor({basePrice,baseDuration,rules,custom=[],serviceCategory='ALL',onSave}:{basePrice:string;baseDuration:number;rules:Rule[];custom?:VehicleCategoryOption[];serviceCategory?:string;onSave:(prices:{category:string;price:string;durationMinutes:number}[])=>Promise<unknown>}){
 const locale=useLocale(),t=useTranslations(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const categories=[...vehicleCategories,...custom.map(item=>item.code),...(serviceCategory!=='ALL'&&!vehicleCategories.some(code=>code===serviceCategory)&&!custom.some(item=>item.code===serviceCategory)?[serviceCategory]:[])].filter(code=>serviceCategory==='ALL'||serviceCategory===code);
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');setSaved(false);const form=new FormData(event.currentTarget);try{await onSave(categories.map(category=>({category,price:String(form.get(category)),durationMinutes:Number(form.get(`duration:${category}`))})));setSaved(true);}catch{setError(t('error'));}finally{setBusy(false);}}
 return <details className="service-pricing-editor"><summary>{t('vehiclePrices')}</summary><form onSubmit={submit}>
  <div className="service-price-grid">{categories.map(category=><div className="service-category-rule" key={category}><strong>{custom.find(item=>item.code===category)?.[locale==='ar'?'nameAr':'nameEn']??vehicleCategoryLabel(category,locale)}</strong><label className="field">{t('price')}<input name={category} type="number" min="0" step="0.01" required defaultValue={rules.find(rule=>rule.category===category&&rule.size==='ALL')?.price??basePrice}/></label><label className="field">{t('expectedMinutes')}<input name={`duration:${category}`} type="number" min="1" max="1440" step="1" required defaultValue={rules.find(rule=>rule.category===category&&rule.size==='ALL')?.durationMinutes??baseDuration}/></label></div>)}</div>
  <button className="button primary" disabled={busy||!categories.length}>{t('saveVehiclePrices')}</button>
  {saved&&<small role="status">{t('saved')}</small>}{error&&<small role="alert">{error}</small>}
 </form></details>;
}
