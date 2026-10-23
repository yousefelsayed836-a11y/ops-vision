import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db} from './db';
import {assert} from './errors';
import {audit,transaction,type Tx} from './transactions';
import {builtinVehicleCategories} from './catalog';
import {platform,tenant,type Actor} from './access';
import {isPlatformAdmin} from './permissions';

const label=z.string().trim().min(2).max(80);
const price=z.string().regex(/^\d{1,9}(\.\d{1,2})?$/);
const code=z.string().regex(/^[A-Z][A-Z0-9_]{1,39}$/);

export async function categoryExists(tx:Tx,orgId:string,value:string){
 return value==='ALL'||builtinVehicleCategories.includes(value as (typeof builtinVehicleCategories)[number])||!!(await tx.vehicleCategory.findFirst({where:{orgId,code:value,active:true}}));
}

export async function catalogManager(actor:Actor,orgId:string){
 if(isPlatformAdmin(actor.platformRole)&&(actor.platformRole==='SUPER_ADMIN'||actor.platformPermissions?.includes('platform.manage_tenants'))){
  platform(actor,'platform.manage_tenants');
  assert(await db.organization.findFirst({where:{id:orgId,status:'ACTIVE'}}),'NOT_FOUND',404);
 }else await tenant(actor,orgId,'tenant.manage_services');
}

export async function addVehicleCategory(actor:Actor,orgId:string,raw:unknown){
 await catalogManager(actor,orgId);
 const data=z.object({nameAr:label,nameEn:label}).parse(raw);
 return transaction(async tx=>{
  const record=await tx.vehicleCategory.create({data:{orgId,code:`CUSTOM_${randomUUID().replaceAll('-','').slice(0,16).toUpperCase()}`,nameAr:data.nameAr,nameEn:data.nameEn}});
  await audit(tx,actor.id,'vehicle_category.created','vehicle_category',record.id,orgId);
  return record;
 });
}

export async function saveServicePrices(actor:Actor,orgId:string,serviceId:string,raw:unknown){
 await catalogManager(actor,orgId);
 const data=z.object({prices:z.array(z.object({category:code,price,durationMinutes:z.coerce.number().int().min(1).max(1440).optional()})).min(1).max(100)}).parse(raw);
 assert(new Set(data.prices.map(item=>item.category)).size===data.prices.length,'DUPLICATE_CATEGORY',422);
 return transaction(async tx=>{
  const service=await tx.washService.findFirst({where:{id:serviceId,orgId}});
  assert(service,'NOT_FOUND',404);
  for(const item of data.prices){
   assert(await categoryExists(tx,orgId,item.category),'INVALID_CATEGORY',422);
   assert(service.category==='ALL'||service.category===item.category,'SERVICE_CATEGORY_MISMATCH',422);
  }
  for(const item of data.prices){
   await tx.servicePricingRule.upsert({where:{serviceId_category_size:{serviceId,category:item.category,size:'ALL'}},create:{orgId,serviceId,category:item.category,size:'ALL',price:item.price,durationMinutes:item.durationMinutes??service.durationMinutes},update:{price:item.price,...(item.durationMinutes?{durationMinutes:item.durationMinutes}:{})}});
  }
  await audit(tx,actor.id,'service.prices_saved','service',serviceId,orgId);
  return tx.servicePricingRule.findMany({where:{orgId,serviceId,size:'ALL'}});
 });
}
