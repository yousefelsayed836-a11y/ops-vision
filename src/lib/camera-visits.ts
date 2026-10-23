import {createHash} from 'node:crypto';
import {z} from 'zod';
import {db} from './db';
import {assert} from './errors';
import type {Scope} from './access';
import {audit,transaction,type Tx} from './transactions';
import type {VideoReport} from './video-analysis';
import {serviceDurationForCategory} from './catalog';
import {inferServiceFromDuration} from './wash-duration-inference';
type CameraJob={id:string;orgId:string;branchId:string;cameraId:string|null;sourceSha256:string;config:unknown};
type GateEvent={type:string;videoSeconds:number;confidence:number;bayId?:string|null};
export async function recordCameraVisit(tx:Tx,job:CameraJob,report:VideoReport,event:GateEvent){
 const config=job.config as {bayId?:string;recordingStartedAt?:string};const mappedBayId=event.bayId??config.bayId;if(!mappedBayId)return;
 const bay=await tx.washBay.findFirst({where:{id:mappedBayId,orgId:job.orgId,branchId:job.branchId}});assert(bay,'INVALID_CAMERA_BAY',422);
 if(job.cameraId){const camera=await tx.camera.findFirst({where:{id:job.cameraId,orgId:job.orgId,branchId:job.branchId}});assert(camera,'INVALID_CAMERA_BAY',422);if(camera.bayId!==bay.id)assert(camera.ipAddress&&await tx.camera.findFirst({where:{orgId:job.orgId,branchId:job.branchId,bayId:bay.id,ipAddress:camera.ipAddress}}),'INVALID_CAMERA_BAY',422);}
 const streamKey=createHash('sha256').update(`${job.sourceSha256}:${job.cameraId??'unassigned'}:${bay.id}`).digest('hex');
 const at=config.recordingStartedAt?new Date(new Date(config.recordingStartedAt).getTime()+event.videoSeconds*1000):null;
 if(event.type==='vehicle.entered_bay'){
  const episodeKey=`${streamKey}:${event.videoSeconds.toFixed(3)}`;
  // COCO's broad class is recorded separately from unproven sedan/CUV/SUV labels.
  const track=(report.tracks??[]).filter(t=>t.firstSeenSeconds<=event.videoSeconds+3&&t.lastSeenSeconds>=event.videoSeconds-3).sort((a,b)=>b.confidence-a.confidence)[0];
  const classification=report.automation?.cycles?.find(c=>(!c.bayId||c.bayId===bay.id)&&c.entrySeconds===event.videoSeconds)?.classification;
  const validShape=classification?.source==='AI_VISUAL'&&['SEDAN','SUV','FULL_SIZE_SUV'].includes(classification.category)&&Number.isFinite(classification.similarity)&&classification.similarity!>=.22&&Number.isFinite(classification.margin)&&classification.margin!>=.025;
  const door=report.automation?.cycles?.find(c=>(!c.bayId||c.bayId===bay.id)&&c.entrySeconds===event.videoSeconds)?.doorActivity;
  const shape={category:validShape?classification!.category:'UNKNOWN',categorySource:validShape?'AI_VISUAL':'UNRESOLVED',categoryEvidence:classification?JSON.parse(JSON.stringify({...classification,analysisId:job.id})):{} ,washType:door?.washType??'UNKNOWN',washTypeEvidence:door?JSON.parse(JSON.stringify(door)):{} };
  const existing=await tx.cameraVisit.findUnique({where:{orgId_episodeKey:{orgId:job.orgId,episodeKey}}});
  const vehicleClass=['CAR','TRUCK','BUS','MOTORCYCLE'].includes(track?.vehicleClass?.toUpperCase())?track.vehicleClass.toUpperCase():'UNKNOWN';
  return tx.cameraVisit.upsert({where:{orgId_episodeKey:{orgId:job.orgId,episodeKey}},update:existing?.categorySource==='HUMAN_REVIEW'?{}:shape,create:{orgId:job.orgId,branchId:job.branchId,bayId:bay.id,cameraId:job.cameraId,analysisId:job.id,streamKey,episodeKey,enteredSeconds:event.videoSeconds,enteredAt:at,entryConfidence:event.confidence,vehicleClass,...shape,replay:true}});
 }
 const already=await tx.cameraVisit.findFirst({where:{orgId:job.orgId,streamKey,exitedSeconds:event.videoSeconds}});if(already)return already;
 const open=await tx.cameraVisit.findFirst({where:{orgId:job.orgId,streamKey,status:'IN_BAY',enteredSeconds:{lte:event.videoSeconds}},orderBy:{enteredSeconds:'desc'}});if(!open)return;
 const occupancySeconds=Math.round((event.videoSeconds-open.enteredSeconds)*1000)/1000;
 const services=await tx.washService.findMany({where:{orgId:job.orgId,active:true},include:{pricingRules:true}});
 const candidates=services.map(service=>({id:service.id,name:service.nameAr,minutes:serviceDurationForCategory(service,open.category)}));
 const inference=inferServiceFromDuration(occupancySeconds,candidates);
 const evidence={...(typeof open.washTypeEvidence==='object'&&open.washTypeEvidence?open.washTypeEvidence:{}),durationInference:{observedSeconds:occupancySeconds,...inference}};
 const uncertain=inference.requiresReview||open.category==='UNKNOWN'||open.washType==='UNKNOWN';
 const result=await tx.cameraVisit.update({where:{id:open.id},data:{status:'EXITED',exitedSeconds:event.videoSeconds,exitedAt:at,occupancySeconds,exitConfidence:event.confidence,washTypeEvidence:JSON.parse(JSON.stringify(evidence))}});
 if(uncertain){
  const message=`مراجعة قراءة الكاميرا في ${bay.name}: ${inference.requiresReview?'نوع الخدمة من المدة غير مؤكد. ':''}${open.category==='UNKNOWN'?'نوع العربية غير مؤكد. ':''}${open.washType==='UNKNOWN'?'نشاط الأبواب غير واضح.':''}`;
  for(const [audience,orgId,permission] of [['platform',null,'platform.manage_tenants'],['owner',job.orgId,'tenant.manage_profile'],['assistant',job.orgId,'wash.view_sessions']] as const){
   await tx.notification.upsert({where:{sourceKey:`camera-review:${open.id}:${audience}`},create:{sourceKey:`camera-review:${open.id}:${audience}`,orgId,permission,type:'CAMERA_REVIEW',message},update:{}});
  }
 }
 return result;
}
export async function listCameraVisits(scope:Scope){
 assert(scope.permissions.includes('wash.view_sessions'),'FORBIDDEN',403);
 return db.cameraVisit.findMany({where:{orgId:scope.orgId,...(scope.branchId?{branchId:scope.branchId}:{})},orderBy:{createdAt:'desc'},take:100,select:{id:true,bayId:true,status:true,replay:true,enteredSeconds:true,exitedSeconds:true,occupancySeconds:true,enteredAt:true,exitedAt:true,entryConfidence:true,exitConfidence:true,vehicleClass:true,category:true,categorySource:true,washStatus:true,washType:true,washTypeEvidence:true,createdAt:true,bay:{select:{name:true,branch:{select:{name:true}}}}}});
}
export async function reviewCameraVisit(scope:Scope,id:string,raw:unknown){
 assert(scope.permissions.includes('wash.view_sessions')&&scope.permissions.includes('wash.complete_session'),'FORBIDDEN',403);
 const data=z.object({category:z.enum(['UNKNOWN','SEDAN','SUV','FULL_SIZE_SUV']),washed:z.boolean(),serviceId:z.uuid().nullable().optional()}).parse(raw);
 return transaction(async tx=>{
  const visit=await tx.cameraVisit.findFirst({where:{id,orgId:scope.orgId,...(scope.branchId?{branchId:scope.branchId}:{})}});assert(visit,'NOT_FOUND',404);assert(visit.status==='EXITED','CAMERA_VISIT_STILL_ACTIVE',409);
  const service=data.serviceId?await tx.washService.findFirst({where:{id:data.serviceId,orgId:scope.orgId,active:true}}):null;
  if(data.serviceId)assert(service,'NOT_FOUND',404);
  const evidence={...(typeof visit.washTypeEvidence==='object'&&visit.washTypeEvidence?visit.washTypeEvidence:{}),humanReview:{serviceId:service?.id??null,serviceName:service?.nameAr??null,reviewedAt:new Date().toISOString()}};
  const result=await tx.cameraVisit.update({where:{id:visit.id},data:{category:data.category,categorySource:data.category==='UNKNOWN'?'UNRESOLVED':'HUMAN_REVIEW',washStatus:data.washed?'CONFIRMED':'NOT_WASHED',washTypeEvidence:JSON.parse(JSON.stringify(evidence)),reviewedBy:scope.actor.id,reviewedAt:new Date()}});
  await audit(tx,scope.actor.id,'camera_visit.reviewed','camera_visit',visit.id,scope.orgId,{category:data.category,washed:data.washed,replay:visit.replay});return {id:result.id};
 });
}
