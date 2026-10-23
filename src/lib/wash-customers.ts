import {z} from 'zod';
import {db} from './db';
import {assert} from './errors';
import {branchScope,type Scope} from './access';
import {transaction,audit} from './transactions';
import {vehicleInput} from './validation';
import {quickWash} from './quick-wash';
export async function listWashCustomers(scope:Scope){
 assert(scope.permissions.includes('tenant.manage_customers'),'FORBIDDEN',403);
 return db.customerProfile.findMany({
  where:{orgId:scope.orgId,...(scope.branchId?{washes:{some:{branchId:scope.branchId}}}:{})},
  orderBy:{updatedAt:'desc'},take:100,
  select:{id:true,name:true,phone:true,createdAt:true,washes:{
   where:scope.branchId?{branchId:scope.branchId}:{},orderBy:{createdAt:'desc'},take:10,
   select:{id:true,status:true,createdAt:true,vehicle:{select:{category:true,size:true}},bay:{select:{name:true}},branch:{select:{name:true}}}
  }}
 });
}
export async function quickCustomer(scope:Scope,raw:unknown){
 assert(scope.permissions.includes('tenant.manage_customers'),'FORBIDDEN',403);
 const data=z.object({name:z.string().trim().min(2).max(120),phone:z.string().trim().min(7).max(30).regex(/^[+\d\s()-]+$/).transform(v=>v.replace(/[\s()-]/g,'')),bayId:z.uuid(),serviceId:z.uuid().optional(),category:vehicleInput.shape.category,size:vehicleInput.shape.size}).parse(raw);
 const bay=await db.washBay.findFirst({where:{id:data.bayId,orgId:scope.orgId,branch:{active:true},org:{status:'ACTIVE'}}});assert(bay,'NOT_FOUND',404);branchScope(scope,bay.branchId);
 let wash=bay.activeWashId?await db.wash.findFirst({where:{id:bay.activeWashId,orgId:scope.orgId,branchId:bay.branchId},include:{vehicle:true}}):null;
 if(wash){if((raw as {size?:unknown}).size===undefined)data.size=vehicleInput.shape.size.parse(wash.vehicle.size);assert(wash.vehicle.category===data.category&&wash.vehicle.size===data.size,'VEHICLE_DETAILS_MISMATCH',409);}
 else {assert(data.serviceId,'SERVICE_REQUIRED',422);const created=await quickWash(scope,{branchId:bay.branchId,bayId:bay.id,serviceId:data.serviceId,vehicle:{category:data.category,...((raw as {size?:unknown}).size===undefined?{}:{size:data.size})}});wash=await db.wash.findUniqueOrThrow({where:{id:created.id},include:{vehicle:true}});}
 const washId=wash.id;
 const customer=await transaction(async tx=>{
  const current=await tx.wash.findFirst({where:{id:washId,orgId:scope.orgId}});assert(current,'NOT_FOUND',404);branchScope(scope,current.branchId);
  const existing=await tx.customerProfile.findUnique({where:{orgId_phone:{orgId:scope.orgId,phone:data.phone}}});
  assert(!current.customerProfileId||current.customerProfileId===existing?.id,'CUSTOMER_ALREADY_LINKED',409);
  const profile=await tx.customerProfile.upsert({where:{orgId_phone:{orgId:scope.orgId,phone:data.phone}},create:{orgId:scope.orgId,name:data.name,phone:data.phone},update:{name:data.name}});
  await tx.wash.update({where:{id:washId},data:{customerProfileId:profile.id}});await audit(tx,scope.actor.id,'customer.quick_created','customer_profile',profile.id,scope.orgId,{washId,bayId:bay.id});return profile;
 });
 return {customerId:customer.id,washId};
}
