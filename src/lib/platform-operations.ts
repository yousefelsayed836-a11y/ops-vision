import {z} from 'zod';
import {db} from './db';
import {platform,type Actor,type Scope} from './access';
import {assert} from './errors';
import {createVehicle,createWash,transitionWash} from './operations';
import {vehicleInput} from './validation';
import {randomUUID} from 'node:crypto';
import {adjustWashMinutes,addWashExtraService,removeWashExtraService} from './wash-extras';
export async function platformBays(actor:Actor){
 platform(actor,'platform.view_bays');
 const organizations=await db.organization.findMany({where:{status:'ACTIVE'},take:500,orderBy:[{name:'asc'},{id:'asc'}],select:{id:true,name:true,slug:true,currency:true,status:true,isDemo:true,branches:{select:{id:true,name:true,city:true,active:true},orderBy:{name:'asc'}},_count:{select:{bays:true,branches:true,cameras:true}}}});
 const orgIds=organizations.map(org=>org.id);
 const bays=await db.washBay.findMany({where:{orgId:{in:orgIds}},take:500,orderBy:[{orgId:'asc'},{branchId:'asc'},{name:'asc'},{id:'asc'}],include:{org:{select:{name:true}},branch:{select:{name:true,city:true,timezone:true,opensAt:true,closesAt:true,active:true}},cameras:{orderBy:{id:'asc'},select:{id:true,name:true,status:true,protocol:true,ipAddress:actor.platformRole==='SUPER_ADMIN'||!!actor.platformPermissions?.includes('platform.manage_cameras')}}}});
 const [services,washes,vehicleCategories]=await Promise.all([
  db.washService.findMany({where:{orgId:{in:orgIds},active:true},select:{id:true,orgId:true,nameAr:true,nameEn:true,category:true,durationMinutes:true,price:true,pricingRules:{select:{id:true,category:true,size:true,price:true,durationMinutes:true}}}}),
  db.wash.findMany({where:{id:{in:bays.flatMap(b=>b.activeWashId?[b.activeWashId]:[])}},select:{id:true,orgId:true,status:true,version:true,serviceId:true,serviceNameAr:true,serviceNameEn:true,startedAt:true,checkedInAt:true,estimatedMinutes:true,timeAdjustmentSeconds:true,extraServices:{select:{id:true,serviceId:true,nameAr:true,nameEn:true},orderBy:{createdAt:'asc'}},vehicle:{select:{category:true,size:true}}}}),
  db.vehicleCategory.findMany({where:{orgId:{in:orgIds},active:true},select:{orgId:true,code:true,nameAr:true,nameEn:true}})
 ]);
 return {organizations,bays:bays.map(b=>({id:b.id,orgId:b.orgId,branchId:b.branchId,name:b.name,organization:b.org.name,branch:b.branch.name,branchDetails:b.branch,cameras:b.cameras,status:b.status,wash:washes.find(w=>w.id===b.activeWashId)??null})),services,vehicleCategories,limit:500};
}
export async function platformStart(actor:Actor,raw:unknown){
 platform(actor,'platform.operate_washes');
 const data=z.object({orgId:z.uuid(),bayId:z.uuid(),serviceId:z.uuid(),vehicle:vehicleInput.extend({plate:vehicleInput.shape.plate.optional()})}).parse(raw);
 data.vehicle.plate ||= `AUTO-${randomUUID().replaceAll('-','')}`;
 const bay=await db.washBay.findFirst({where:{id:data.bayId,orgId:data.orgId,org:{status:'ACTIVE'},branch:{active:true}}});assert(bay,'NOT_FOUND',404);assert(bay.status==='AVAILABLE'&&!bay.activeWashId,'BAY_UNAVAILABLE',409);
 const service=await db.washService.findFirst({where:{id:data.serviceId,orgId:data.orgId,active:true}});assert(service,'NOT_FOUND',404);assert(service.category==='ALL'||service.category===data.vehicle.category,'SERVICE_CATEGORY_MISMATCH',422);
 const org=await db.organization.findUniqueOrThrow({where:{id:data.orgId}});
 const scope:Scope={actor,orgId:org.id,branchId:bay.branchId,role:'PLATFORM_OPERATOR',isDemo:org.isDemo,permissions:['wash.start_session']};
 let vehicle=await db.vehicle.findUnique({where:{orgId_plate:{orgId:org.id,plate:data.vehicle.plate}}});
 if(vehicle){if((raw as {vehicle?:{size?:unknown}}).vehicle?.size===undefined)data.vehicle.size=vehicleInput.shape.size.parse(vehicle.size);assert(vehicle.category===data.vehicle.category&&vehicle.size===data.vehicle.size,'VEHICLE_DETAILS_MISMATCH',409);}
 else vehicle=await createVehicle(scope,data.vehicle);
 const wash=await createWash(scope,{branchId:bay.branchId,bayId:bay.id,serviceId:service.id,vehicleId:vehicle.id},true);
 return {id:wash.id,status:'WASHING'};
}

export async function platformWashTransition(actor:Actor,id:string,raw:unknown){
 const data=z.object({orgId:z.uuid(),to:z.enum(['WASHING','PAUSED','COMPLETED']),version:z.number().int().min(0)}).parse(raw);z.uuid().parse(id);
 platform(actor,data.to==='COMPLETED'?'platform.complete_washes':'platform.operate_washes');
 const wash=await db.wash.findFirst({where:{id,orgId:data.orgId,org:{status:'ACTIVE'}}});assert(wash,'NOT_FOUND',404);
 const org=await db.organization.findUniqueOrThrow({where:{id:data.orgId}});
 const scope:Scope={actor,orgId:data.orgId,branchId:wash.branchId,role:'PLATFORM_OPERATOR',isDemo:org.isDemo,permissions:[data.to==='COMPLETED'?'wash.complete_session':data.to==='PAUSED'?'wash.pause_session':'wash.start_session']};
 return transitionWash(scope,id,data.to,data.version);
}
export async function platformAdjustWashMinutes(actor:Actor,id:string,raw:unknown){
 platform(actor,'platform.operate_washes');
 const input=z.object({orgId:z.uuid(),deltaSeconds:z.number().int()}).parse(raw);
 const wash=await db.wash.findFirst({where:{id,orgId:input.orgId,org:{status:'ACTIVE'}}});assert(wash,'NOT_FOUND',404);
 const org=await db.organization.findUniqueOrThrow({where:{id:input.orgId}});
 const scope:Scope={actor,orgId:input.orgId,branchId:wash.branchId,role:'PLATFORM_OPERATOR',isDemo:org.isDemo,permissions:['wash.start_session']};
 return adjustWashMinutes(scope,id,{deltaSeconds:input.deltaSeconds});
}
export async function platformWashExtraService(actor:Actor,id:string,raw:unknown,extraId?:string){
 platform(actor,'platform.operate_washes');
 const data=z.object({orgId:z.uuid(),serviceId:z.uuid().optional()}).parse(raw);
 const wash=await db.wash.findFirst({where:{id,orgId:data.orgId,org:{status:'ACTIVE'}}});assert(wash,'NOT_FOUND',404);
 const org=await db.organization.findUniqueOrThrow({where:{id:data.orgId}});
 const scope:Scope={actor,orgId:data.orgId,branchId:wash.branchId,role:'PLATFORM_OPERATOR',isDemo:org.isDemo,permissions:['wash.manage_services']};
 if(extraId)return removeWashExtraService(scope,id,extraId);
 assert(data.serviceId,'SERVICE_REQUIRED',422);
 return addWashExtraService(scope,id,{serviceId:data.serviceId});
}
