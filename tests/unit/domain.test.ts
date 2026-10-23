import {describe,it,expect} from 'vitest';
import {validTransition,times,transitions} from '../../src/lib/domain';
import {canDelegate,roles} from '../../src/lib/permissions';
import {applicationInput,password,serviceInput} from '../../src/lib/validation';
import {digest,seal,unseal,token} from '../../src/lib/crypto';
import ar from '../../src/messages/ar.json';
import en from '../../src/messages/en.json';
import {servicePriceForCategory} from '../../src/lib/catalog';

describe('operational state and time accounting',()=>{
  it('allows direct completion while keeping inspection optional',()=>{expect(validTransition('WASHING','COMPLETED')).toBe(true);expect(validTransition('WASHING','INSPECTION')).toBe(true);expect(validTransition('ASSIGNED','COMPLETED')).toBe(false);});
  it('does not reopen delivered or cancelled sessions',()=>{expect(transitions.DELIVERED).toEqual([]);expect(transitions.CANCELLED).toEqual([]);});
  it('resumes paused work without returning to check-in',()=>{expect(validTransition('PAUSED','WASHING')).toBe(true);expect(validTransition('PAUSED','CHECKED_IN')).toBe(false);});
  it('does not count pre-booking days as customer waiting time',()=>{const time=new Date();const result=times([{toStatus:'BOOKED',createdAt:new Date(time.getTime()-86400000)},{toStatus:'CHECKED_IN',createdAt:new Date(time.getTime()-60000)}],time);expect(result.totalMs).toBe(60000);expect(result.waitMs).toBe(60000);});
  it('separates wait, occupancy, active wash, pause and inspection',()=>{
    const origin=Date.UTC(2026,9,18);const history=[['CHECKED_IN',0],['ASSIGNED',2],['WASHING',3],['PAUSED',8],['WASHING',10],['INSPECTION',16],['COMPLETED',18]].map(([toStatus,min])=>({toStatus:String(toStatus),createdAt:new Date(origin+Number(min)*60000)}));
    const result=times(history,new Date(origin+18*60000));expect(result).toMatchObject({waitMs:120000,washMs:660000,pauseMs:120000,inspectionMs:120000,bayMs:960000});
  });
});
describe('service prices by vehicle type',()=>{
 it('shows the category price used by wash creation and falls back to the base price',()=>{
  const service={price:'80.00',pricingRules:[{category:'SUV',size:'ALL',price:'120.00'},{category:'BICYCLE',size:'ALL',price:'25.00'}]};
  expect(servicePriceForCategory(service,'SUV')).toBe('120.00');
  expect(servicePriceForCategory(service,'BICYCLE')).toBe('25.00');
  expect(servicePriceForCategory(service,'SEDAN')).toBe('80.00');
 });
});
describe('permission boundaries',()=>{
  it('does not permit delegated platform privileges',()=>expect(canDelegate(roles.OWNER,['platform.manage_tenants'])).toBe(false));
  it('does not let a worker grant cashier access',()=>expect(canDelegate(roles.WORKER,['finance.manage_payments'])).toBe(false));
  it('permits delegating an owned permission',()=>expect(canDelegate(roles.OWNER,['tenant.manage_services'])).toBe(true));
  it('does not let a view-only owner delegate wash start',()=>expect(canDelegate(roles.OWNER,['wash.start_session'])).toBe(false));
});
describe('input invariants',()=>{
  it('normalizes email addresses',()=>{const result=applicationInput.parse({businessName:'Wash A',ownerName:'Owner A',email:'OWNER@EXAMPLE.COM',phone:'+20123456789',city:'Cairo',branchCount:'2'});expect(result.email).toBe('owner@example.com');});
  it('rejects weak-length passwords',()=>expect(password.safeParse('short').success).toBe(false));
  it('rejects negative or excessive-precision prices',()=>{const base={nameAr:'غسيل',nameEn:'Wash',durationMinutes:20};expect(serviceInput.safeParse({...base,price:'-5'}).success).toBe(false);expect(serviceInput.safeParse({...base,price:'1.001'}).success).toBe(false);});
  it('rejects zero-minute services',()=>expect(serviceInput.safeParse({nameAr:'غسيل',nameEn:'Wash',durationMinutes:0,price:'10'}).success).toBe(false));
});
describe('tokens and encrypted outbox',()=>{
  it('generates distinct cryptographic tokens and only a one-way index',()=>{const a=token();const b=token();expect(a.raw).not.toBe(b.raw);expect(a.hash).toBe(digest(a.raw));expect(a.hash).not.toContain(a.raw);});
  it('encrypts activation payloads and detects tampering',()=>{process.env.BETTER_AUTH_SECRET='test-only-secret-with-more-than-32-characters';const value={token:token().raw};const encrypted=seal(value);expect(encrypted).not.toContain(value.token);expect(unseal(encrypted)).toEqual(value);const pieces=encrypted.split('.');pieces[1]=(pieces[1][0]==='A'?'B':'A')+pieces[1].slice(1);expect(()=>unseal(pieces.join('.'))).toThrow();});
});
function keys(value:Record<string,unknown>,prefix=''):string[]{return Object.entries(value).flatMap(([key,v])=>typeof v==='object'&&v?keys(v as Record<string,unknown>,`${prefix}${key}.`):[`${prefix}${key}`]);}
it('keeps Arabic and English message coverage equal',()=>expect(keys(ar).sort()).toEqual(keys(en).sort()));
