"use client";
import {useEffect,useState} from 'react';
import {useTranslations} from 'next-intl';
const key='opsvision-login-emails';
export function rememberLoginEmail(email:string){try{const current=JSON.parse(localStorage.getItem(key)??'[]');const emails=Array.isArray(current)?current.filter((v:unknown):v is string=>typeof v==='string'):[];localStorage.setItem(key,JSON.stringify([email,...emails.filter(v=>v!==email)].slice(0,8)));}catch{/* Storage is optional; never store passwords. */}}
export function LoginFields(){
 const t=useTranslations();
 const [emails,setEmails]=useState<string[]>([]),[email,setEmail]=useState(''),[visible,setVisible]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>{try{const values=JSON.parse(localStorage.getItem(key)??'[]');if(Array.isArray(values))setEmails(values.filter((v:unknown):v is string=>typeof v==='string'));}catch{}},0);return()=>clearTimeout(timer);},[]);
 return <><label className="field">{t('email')}<input type="email" name="email" required autoComplete="username" dir="ltr" value={email} onChange={e=>setEmail(e.target.value)} list="saved-login-emails"/><datalist id="saved-login-emails">{emails.map(value=><option key={value} value={value}/>)}</datalist></label>{emails.length>0&&<label className="field">{t('savedAccounts')}<select value="" onChange={e=>setEmail(e.target.value)}><option value="">{t('chooseAccount')}</option>{emails.map(value=><option key={value} value={value}>{value}</option>)}</select><button type="button" className="text-button" onClick={()=>{try{localStorage.removeItem(key);}catch{}setEmails([]);}}>{t('clearSavedAccounts')}</button></label>}<label className="field">{t('password')}<span className="password-input"><input name="password" type={visible?'text':'password'} required maxLength={128} autoComplete="current-password" dir="ltr"/><button type="button" className="button outline compact" aria-pressed={visible} onClick={()=>setVisible(v=>!v)}>{t(visible?'hidePassword':'showPassword')}</button></span></label><small className="muted">{t('savedAccountsHelp')}</small></>;
}
