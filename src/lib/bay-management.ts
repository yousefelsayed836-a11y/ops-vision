import {cameraCalibrationInput} from './camera-calibration';
import type {Prisma} from '@/generated/prisma/client';
import {z} from 'zod';
import {db} from './db';
import {platform,branchScope,type Actor,type Scope} from './access';
import {assert} from './errors';
import {transaction,audit} from './transactions';
import {bayInput} from './validation';
export async function createBay(scope:Scope,raw:unknown){
 assert(scope.permissions.includes('tenant.manage_bays'),'FORBIDDEN',403);const data=bayInput.parse(raw);branchScope(scope,data.branchId);
 return transaction(async tx=>{assert(await tx.branch.findFirst({where:{id:data.branchId,orgId:scope.orgId,active:true,org:{status:'ACTIVE'}}}),'NOT_FOUND',404);const bay=await tx.washBay.create({data:{...data,orgId:scope.orgId}});await audit(tx,scope.actor.id,'bay.created','bay',bay.id,scope.orgId);return bay;});
}
export async function updateBay(scope:Scope,id:string,raw:unknown){
 assert(scope.permissions.includes('tenant.manage_bays'),'FORBIDDEN',403);z.uuid().parse(id);
 const data=z.object({name:z.string().trim().min(2).max(120).optional(),status:z.enum(['AVAILABLE','MAINTENANCE','DISABLED']).optional()}).refine(v=>v.name!==undefined||v.status!==undefined).parse(raw);
 return transaction(async tx=>{const bay=await tx.washBay.findFirst({where:{id,orgId:scope.orgId}});assert(bay,'NOT_FOUND',404);branchScope(scope,bay.branchId);if(data.status)assert(!bay.activeWashId&&bay.status!=='OCCUPIED','BAY_OCCUPIED',409);const result=await tx.washBay.update({where:{id},data});await audit(tx,scope.actor.id,'bay.updated','bay',id,scope.orgId,data);return result;});
}
export async function saveCameraIp(scope:Scope,raw:unknown){
 assert(scope.permissions.includes('tenant.manage_cameras'),'FORBIDDEN',403);const data=z.object({bayId:z.uuid(),ipAddress:z.union([z.ipv4(),z.ipv6()])}).parse(raw);
 return transaction(async tx=>{const bay=await tx.washBay.findFirst({where:{id:data.bayId,orgId:scope.orgId}});assert(bay,'NOT_FOUND',404);branchScope(scope,bay.branchId);const existing=await tx.camera.findFirst({where:{orgId:scope.orgId,bayId:bay.id},orderBy:{id:'asc'}});const result=existing?await tx.camera.update({where:{id:existing.id},data:{ipAddress:data.ipAddress,status:'UNCONFIGURED',processingEnabled:false,protocol:existing.protocol==='SIMULATED'?'RTSP':existing.protocol}}):await tx.camera.create({data:{orgId:scope.orgId,branchId:bay.branchId,bayId:bay.id,name:bay.name,ipAddress:data.ipAddress,protocol:'RTSP',status:'UNCONFIGURED'}});await audit(tx,scope.actor.id,'camera.ip_saved','camera',result.id,scope.orgId);return {id:result.id,ipAddress:result.ipAddress};});
}
export async function registerCameraIp(scope:Scope,raw:unknown){
 assert(scope.permissions.includes('tenant.manage_cameras'),'FORBIDDEN',403);
 const data=z.object({branchId:z.uuid(),name:z.string().trim().min(2).max(120),ipAddress:z.union([z.ipv4(),z.ipv6()])}).parse(raw);
 branchScope(scope,data.branchId);
 return transaction(async tx=>{
  assert(await tx.branch.findFirst({where:{id:data.branchId,orgId:scope.orgId,active:true,org:{status:'ACTIVE'}}}),'NOT_FOUND',404);
  const existing=await tx.camera.findFirst({where:{orgId:scope.orgId,branchId:data.branchId,ipAddress:data.ipAddress},orderBy:{id:'asc'}});
  if(existing)return {id:existing.id,alreadyExists:true};
  const camera=await tx.camera.create({data:{orgId:scope.orgId,branchId:data.branchId,name:data.name,ipAddress:data.ipAddress,protocol:'RTSP',status:'UNCONFIGURED',zones:{kind:'BAY_MAPPING_V1',bayMappings:[]}}});
  await audit(tx,scope.actor.id,'camera.ip_registered','camera',camera.id,scope.orgId);
  return {id:camera.id,alreadyExists:false};
 });
}
const cameraBayMappingInput=z.object({bays:z.array(z.object({bayId:z.uuid(),number:z.coerce.number().int().min(1).max(999)})).max(100)});
export async function saveCameraBayMappings(scope:Scope,cameraId:string,raw:unknown){
 assert(scope.permissions.includes('tenant.manage_cameras'),'FORBIDDEN',403);z.uuid().parse(cameraId);
 const data=cameraBayMappingInput.parse(raw);
 assert(new Set(data.bays.map(item=>item.bayId)).size===data.bays.length,'DUPLICATE_BAY',422);
 assert(new Set(data.bays.map(item=>item.number)).size===data.bays.length,'DUPLICATE_BAY_NUMBER',422);
 return transaction(async tx=>{
  const camera=await tx.camera.findFirst({where:{id:cameraId,orgId:scope.orgId,org:{status:'ACTIVE'}}});assert(camera,'NOT_FOUND',404);branchScope(scope,camera.branchId);
  const bays=await tx.washBay.findMany({where:{id:{in:data.bays.map(item=>item.bayId)},orgId:scope.orgId,branchId:camera.branchId}});
  assert(bays.length===data.bays.length,'INVALID_CAMERA_BAY',422);
  const previous=camera.zones&&typeof camera.zones==='object'&&!Array.isArray(camera.zones)?camera.zones as Record<string,unknown>:{};
  const zones={...previous,bayMappings:data.bays,version:typeof previous.version==='number'?previous.version+1:1};
  await tx.camera.update({where:{id:camera.id},data:{zones:zones as Prisma.InputJsonValue}});
  await audit(tx,scope.actor.id,'camera.bays_mapped','camera',camera.id,scope.orgId,{bayIds:data.bays.map(item=>item.bayId)});
  return {id:camera.id,bayMappings:data.bays};
 });
}
export async function platformBayScope(actor:Actor,orgId:string,permission:'platform.manage_bays'|'platform.manage_cameras'):Promise<Scope>{
 platform(actor,permission);z.uuid().parse(orgId);const org=await db.organization.findFirst({where:{id:orgId,status:'ACTIVE'}});assert(org,'NOT_FOUND',404);return {actor,orgId,branchId:null,role:'PLATFORM_OPERATOR',isDemo:org.isDemo,permissions:[permission==='platform.manage_bays'?'tenant.manage_bays':'tenant.manage_cameras']};
}

export async function saveCameraCalibration(scope:Scope,id:string,raw:unknown){
 assert(scope.permissions.includes('tenant.manage_cameras'),'FORBIDDEN',403);z.uuid().parse(id);const input=cameraCalibrationInput.parse(raw);
 return transaction(async tx=>{const camera=await tx.camera.findFirst({where:{id,orgId:scope.orgId,org:{status:'ACTIVE'}}});assert(camera,'NOT_FOUND',404);branchScope(scope,camera.branchId);const previous=camera.zones&&typeof camera.zones==='object'&&!Array.isArray(camera.zones)?camera.zones as Record<string,unknown>:{};const version=typeof previous.version==='number'?previous.version+1:1;await tx.camera.update({where:{id},data:{zones:{...previous,kind:'BAY_GATE_V1',version,...input} as Prisma.InputJsonValue}});await audit(tx,scope.actor.id,'camera.calibration_saved','camera',id,scope.orgId,{version});return {id,version};});
}
