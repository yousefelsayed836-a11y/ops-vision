"use client";

import {useLocale,useTranslations} from "next-intl";
import {servicePriceForCategory,serviceDurationForCategory} from '@/lib/catalog';

export type ServiceChoice={value:string;label:string;category?:string;durationMinutes?:number;price?:string;pricingRules?:{category:string;size:string;price:string;durationMinutes?:number|null}[]};

export function ServiceChoicePicker({name="serviceId",label,options,category,currency='SAR'}:{name?:string;label:string;options:ServiceChoice[];category:string;currency?:string}){
 const t=useTranslations(),locale=useLocale();
 return <fieldset className="field service-choice-picker">
  <legend>{label}</legend>
  {options.length?<div className="service-choice-options">{options.map(option=>{
   const unavailable=!!option.category&&option.category!=='ALL'&&option.category!==category;
   return <label className="service-choice-option" key={option.value}>
    <input type="radio" name={name} value={option.value} required disabled={unavailable}/>
    <span>{option.label}</span>
    {option.price!==undefined&&<small>{new Intl.NumberFormat(locale,{style:'currency',currency}).format(Number(servicePriceForCategory({price:option.price,pricingRules:option.pricingRules},category)))}</small>}
    {option.durationMinutes&&<small>{serviceDurationForCategory({durationMinutes:option.durationMinutes,pricingRules:option.pricingRules},category)} {t('allBays.minutes')}</small>}
    {unavailable&&<small>{t('serviceNotForVehicle')}</small>}
   </label>;
  })}</div>:<p>{t('allBays.noServices')}</p>}
 </fieldset>;
}
