import {db} from './db';
import {assert} from './errors';

const validSlug=(slug:string)=>/^[a-z0-9-]{3,80}$/.test(slug);

export async function publicWashBays(slug:string){
 assert(validSlug(slug),'NOT_FOUND',404);
 const org=await db.organization.findFirst({where:{slug,status:'ACTIVE'},select:{id:true,name:true,publicNotice:true,vehicleCategories:{where:{active:true},select:{code:true,nameAr:true,nameEn:true}}}});
 assert(org,'NOT_FOUND',404);
 const bays=await db.washBay.findMany({
  where:{orgId:org.id,branch:{active:true}},
  select:{id:true,name:true,branch:{select:{name:true}}},
  orderBy:[{branch:{name:'asc'}},{name:'asc'}],take:200,
 });
 return {organization:org.name,notice:org.publicNotice,vehicleCategories:org.vehicleCategories,bays:bays.map(bay=>({id:bay.id,name:bay.name,branch:bay.branch.name}))};
}

export async function publicBayStatus(slug:string,bayId:string){
 assert(validSlug(slug),'NOT_FOUND',404);
 const bay=await db.washBay.findFirst({
  where:{id:bayId,org:{slug,status:'ACTIVE'},branch:{active:true}},
  select:{id:true,orgId:true,name:true,status:true,activeWashId:true,branch:{select:{name:true}},org:{select:{name:true}}},
 });
 assert(bay,'NOT_FOUND',404);
 const wash=bay.activeWashId?await db.wash.findFirst({where:{id:bay.activeWashId,orgId:bay.orgId,bayId:bay.id},select:{status:true,serviceNameAr:true,serviceNameEn:true,startedAt:true,estimatedMinutes:true,timeAdjustmentSeconds:true,extraServices:{select:{nameAr:true,nameEn:true},orderBy:{createdAt:'asc'}},vehicle:{select:{category:true}}}}):null;
 return {
  organization:bay.org.name,branch:bay.branch.name,bay:bay.name,status:bay.status,
  wash:wash?{status:wash.status,serviceAr:wash.serviceNameAr,serviceEn:wash.serviceNameEn,startedAt:wash.startedAt,estimatedMinutes:wash.estimatedMinutes,timeAdjustmentSeconds:wash.timeAdjustmentSeconds,extraServices:wash.extraServices,category:wash.vehicle.category}:null,
 };
}
