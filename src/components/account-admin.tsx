"use client";
import {useEffect,useState,type FormEvent} from 'react';
import {useTranslations} from 'next-intl';
import {api} from '@/lib/client';

type Account={id:string;name:string;email:string;platformRole:string;disabled:boolean;memberships:{role:string;org:{name:string}}[]};
export function AccountAdmin(){
 const t=useTranslations('accountAdmin');
 const [accounts,setAccounts]=useState<Account[]>([]),[query,setQuery]=useState(''),[busy,setBusy]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{let live=true;void api<Account[]>('platform/accounts').then(value=>{if(live)setAccounts(value);}).catch(()=>{if(live)setMessage(t('error'));});return()=>{live=false;};},[t]);
 async function save(event:FormEvent<HTMLFormElement>,id:string){event.preventDefault();const form=event.currentTarget,values=new FormData(form),email=String(values.get('email')??'').trim(),password=String(values.get('password')??'');setBusy(id);setMessage('');try{await api(`platform/accounts/${id}/credentials`,'PATCH',{email,...(password?{password}:{})});form.reset();setAccounts(await api<Account[]>('platform/accounts'));setMessage(t('saved'));}catch{setMessage(t('error'));}finally{setBusy('');}}
 const filtered=accounts.filter(account=>`${account.name} ${account.email} ${account.memberships.map(member=>member.org.name).join(' ')}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 return <section className="panel account-admin"><h2>{t('title')}</h2><p className="muted">{t('help')}</p><label className="field">{t('search')}<input value={query} onChange={event=>setQuery(event.target.value)}/></label>{message&&<p role="status">{message}</p>}<div className="account-list">{filtered.map(account=><form className="panel form-fields" onSubmit={event=>void save(event,account.id)} key={account.id}><h3>{account.name}</h3><p className="muted">{account.platformRole==='SUPER_ADMIN'?t('platformOwner'):account.memberships.map(member=>`${member.org.name} — ${member.role}`).join(' · ')||account.platformRole}</p><label className="field">{t('email')}<input type="email" name="email" defaultValue={account.email} required maxLength={254} autoComplete="off"/></label><label className="field">{t('newPassword')}<input type="password" name="password" minLength={12} maxLength={128} autoComplete="new-password" placeholder={t('leavePassword')}/></label><button className="button outline" disabled={busy===account.id}>{t('save')}</button></form>)}</div></section>;
}
