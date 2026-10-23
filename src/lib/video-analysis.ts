import {gateInput,cameraCalibrationInput} from "./camera-calibration";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, readFile, unlink, rmdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { z } from "zod";
import { db } from "./db";
import { assert } from "./errors";
import { branchScope, type Scope } from "./access";
import { transaction, audit } from "./transactions";
import type { Prisma } from "@/generated/prisma/client";

export const videoConfig = z.object({
  gate:gateInput.optional(),calibrationVersion:z.number().int().positive().optional(),
  branchId:z.uuid(),cameraId:z.uuid().optional(),bayId:z.uuid().optional(),
  rotation:z.union([z.literal(0),z.literal(90),z.literal(180),z.literal(270)]).default(0),
  zoneAnchor:z.enum(['center','bottom']).default('center'),recordingStartedAt:z.iso.datetime({offset:true}).optional(),
  threshold:z.number().min(.15).max(.9).default(.32),
  minAreaRatio:z.number().min(.0005).max(.2).default(.006),
  sampleFps:z.number().min(.2).max(6).default(1),
  zone:z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1),width:z.number().gt(0).max(1),height:z.number().gt(0).max(1)}).refine(v=>v.x+v.width<=1&&v.y+v.height<=1).optional(),
});
export type ZoneVisit={entrySeconds:number|null;exitSeconds:number|null;entryAt:string|null;exitAt:string|null;observedSeconds:number;durationSeconds:number|null;completePassage:boolean;endReason:string;timingUncertaintySeconds:number};
export type VideoTrack={trackId:string;visits?:ZoneVisit[];vehicleClass:string;category:string;size:string;washType:string;washDurationSeconds:number|null;firstSeenSeconds:number;lastSeenSeconds:number;observedSpanSeconds:number;leftCensored:boolean;rightCensored:boolean;confidence:number;sampleCount:number;zoneIntervals:{start:number;end:number;seconds:number;leftCensored:boolean;rightCensored:boolean}[];evidenceFile:string;samples:{t:number;box:number[];confidence:number}[]};
export type ShapeClassification={category:'UNKNOWN'|'SEDAN'|'SUV'|'FULL_SIZE_SUV';source:string;similarity?:number;margin?:number;scores?:Record<string,number>;model?:string;revision?:string;sampleCount?:number;evidenceSeconds?:number[];requiresReview?:boolean};
export type GateAutomation={engine:string;events:{type:string;videoSeconds:number;confirmedAtSeconds:number;evidence:string;bayId?:string|null}[];cycles:{entrySeconds:number|null;exitSeconds:number|null;bayOccupancySeconds:number|null;bayId?:string|null;classification?:ShapeClassification;doorActivity?:{washType:string;source:string;requiresReview:boolean};complete:boolean}[];completedBayVisits:number};
export type VideoReport={sourceSha256?:string;automation?:GateAutomation;schemaVersion:number;zoneConfigured?:boolean;zoneSummary?:{observedEntries:number;observedExits:number;completePassages:number;partialVisits:number};source:string;model:string;video:{durationSeconds:number;fps:number;width:number;height:number;frames:number};samplingFps:number;framesProcessed:number;runtimeSeconds:number;detectedTracks:number;confirmedWashedCount:number;sceneCuts:number[];tracks:VideoTrack[];limitations:string[]};
export function videoDirectory(id:string){z.uuid().parse(id);return join(resolve('.data/video-analysis'),id);}
export function requireVideoAccess(scope:Scope){assert(scope.permissions.includes('video.analyze'),'FORBIDDEN',403);}
export async function queueVideo(scope:Scope,raw:unknown,sourceName:string,bytes:Uint8Array,reserveForImport=false){
  requireVideoAccess(scope);const config=videoConfig.parse(raw) as z.infer<typeof videoConfig>&{gates?:{bayId:string;gate:z.infer<typeof gateInput>}[]};branchScope(scope,config.branchId);
  assert(bytes.byteLength>16&&bytes.byteLength<=128*1024*1024,'VIDEO_SIZE_LIMIT',413);
  assert(Buffer.from(bytes.subarray(4,8)).toString('ascii')==='ftyp','INVALID_VIDEO_FORMAT',422);
  const branch=await db.branch.findFirst({where:{id:config.branchId,orgId:scope.orgId,active:true}});assert(branch,'NOT_FOUND',404);
  if(config.bayId)assert(await db.washBay.findFirst({where:{id:config.bayId,orgId:scope.orgId,branchId:branch.id}}),'NOT_FOUND',404);
  if(config.cameraId){
    const camera=await db.camera.findFirst({where:{id:config.cameraId,orgId:scope.orgId,branchId:branch.id}});assert(camera,'NOT_FOUND',404);
    const mappings=(camera.zones as {bayMappings?:{bayId:string}[]}|null)?.bayMappings;
    if(config.bayId)assert(camera.bayId===config.bayId||mappings?.some(item=>item.bayId===config.bayId),'INVALID_CAMERA_BAY',422);
    const stored=camera.zones as Record<string,unknown>;const calibration=cameraCalibrationInput.safeParse(stored);
    if(calibration.success){if(!config.gate)config.gate=calibration.data.gate;if((raw as Record<string,unknown>).rotation===undefined)config.rotation=calibration.data.rotation;config.calibrationVersion=typeof stored.version==='number'?stored.version:1;}
    if(camera.ipAddress){
      const shared=await db.camera.findMany({where:{orgId:scope.orgId,branchId:branch.id,ipAddress:camera.ipAddress,bayId:{not:null}}});
      const allowed=mappings?.length?new Set(mappings.map(item=>item.bayId)):null;
      const gates=shared.flatMap(item=>{const calibrated=cameraCalibrationInput.safeParse(item.zones);return item.bayId&&(!allowed||allowed.has(item.bayId))&&calibrated.success?[{bayId:item.bayId,gate:calibrated.data.gate}]:[];});
      if(gates.length>1){config.gates=gates;config.gate=undefined;}
    }
    if(!config.bayId&&camera.bayId)config.bayId=camera.bayId;
  }
  const id=randomUUID(),folder=videoDirectory(id);await mkdir(folder,{recursive:true});const path=join(folder,'source.mp4');
  await writeFile(path,bytes,{flag:'wx'});
  try{return await transaction(async tx=>{
    assert(await tx.videoAnalysis.count({where:{orgId:scope.orgId,status:{in:['QUEUED','PROCESSING']}}})<3,'VIDEO_QUEUE_LIMIT',429);
    assert(await tx.videoAnalysis.count({where:{orgId:scope.orgId}})<100,'VIDEO_STORAGE_LIMIT',429);
    const record=await tx.videoAnalysis.create({data:{id,orgId:scope.orgId,branchId:branch.id,cameraId:config.cameraId,createdBy:scope.actor.id,sourceName:sourceName.replace(/[\x00-\x1f/\\]/g,'_').slice(0,150),storageKey:id,status:reserveForImport?'PROCESSING':'QUEUED',lockedAt:reserveForImport?new Date():undefined,sourceSha256:createHash('sha256').update(bytes).digest('hex'),config:config as Prisma.InputJsonValue}});
    await audit(tx,scope.actor.id,'video.queued','video_analysis',id,scope.orgId);return {id:record.id,status:record.status};
  });}catch(error){await unlink(path);await rmdir(folder);throw error;}
}
export async function getVideo(scope:Scope,id:string){
  requireVideoAccess(scope);z.uuid().parse(id);
  const job=await db.videoAnalysis.findFirst({where:{id,orgId:scope.orgId,...(scope.branchId?{branchId:scope.branchId}:{})},include:{reviews:{orderBy:{createdAt:'asc'}}}});assert(job,'NOT_FOUND',404);
  const report=job.result as VideoReport|null;const latest=new Map(job.reviews.map(review=>[review.trackId,review]));
  let progress:number|null=null;if(job.status==='PROCESSING'){try{const value=JSON.parse(await readFile(join(videoDirectory(id),'progress.json'),'utf8'));if(Number.isFinite(value.progress))progress=Math.max(0,Math.min(99,value.progress));}catch{}}
  return {...job,progress,storageKey:undefined,sourceSha256:undefined,confirmedWashedCount:[...latest.values()].filter(r=>r.washed===true).length,report};
}
export async function listVideos(scope:Scope){
  requireVideoAccess(scope);const jobs=await db.videoAnalysis.findMany({where:{orgId:scope.orgId,...(scope.branchId?{branchId:scope.branchId}:{})},orderBy:{createdAt:'desc'},take:30,select:{id:true,sourceName:true,status:true,branchId:true,cameraId:true,createdAt:true,completedAt:true,errorCode:true}});return jobs;
}
export async function reviewVideo(scope:Scope,id:string,raw:unknown){
  requireVideoAccess(scope);
  const data=z.object({trackId:z.string().regex(/^V\d{3,5}$/),category:z.enum(['UNKNOWN','SEDAN','SUV','FULL_SIZE_SUV']),size:z.enum(['UNKNOWN','SMALL','MEDIUM','LARGE','XLARGE']).default('UNKNOWN'),serviceId:z.uuid().optional(),washed:z.boolean().nullable(),note:z.string().trim().max(1000).default('')}).parse(raw);
  return transaction(async tx=>{
    const job=await tx.videoAnalysis.findFirst({where:{id,orgId:scope.orgId,status:'COMPLETED'}});assert(job,'NOT_FOUND',404);branchScope(scope,job.branchId);
    const result=job.result as VideoReport|null;assert(result?.tracks.some(track=>track.trackId===data.trackId),'NOT_FOUND',404);
    if(data.serviceId)assert(await tx.washService.findFirst({where:{id:data.serviceId,orgId:scope.orgId}}),'NOT_FOUND',404);
    const review=await tx.videoAnalysisReview.create({data:{...data,analysisId:id,orgId:scope.orgId,actorId:scope.actor.id}});
    await audit(tx,scope.actor.id,'video.reviewed','video_analysis',id,scope.orgId,{trackId:data.trackId,washed:data.washed});return {id:review.id};
  });
}
export async function videoFile(scope:Scope,id:string,kind:string,range:string|null){
  await getVideo(scope,id);
  assert(kind==='source'||kind==='report'||/^V\d{3,5}\.jpg$/.test(kind),'NOT_FOUND',404);
  const filename=kind==='source'?'source.mp4':kind==='report'?'report.json':kind;
  let bytes:Buffer;try{bytes=await readFile(join(videoDirectory(id),filename));}catch{assert(false,'NOT_FOUND',404);}
  const headers:Record<string,string>={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Type':kind==='source'?'video/mp4':kind==='report'?'application/json':'image/jpeg','Accept-Ranges':'bytes'};
  if(kind==='report')headers['Content-Disposition']='attachment; filename="video-report.json"';
  if(range){const match=/^bytes=(\d+)-(\d*)$/.exec(range);assert(match,'INVALID_RANGE',416);const start=Number(match[1]),end=Math.min(bytes.length-1,match[2]?Number(match[2]):bytes.length-1);assert(start<=end&&start<bytes.length,'INVALID_RANGE',416);headers['Content-Range']=`bytes ${start}-${end}/${bytes.length}`;headers['Content-Length']=String(end-start+1);return new Response(new Uint8Array(bytes.subarray(start,end+1)),{status:206,headers});}
  headers['Content-Length']=String(bytes.length);return new Response(new Uint8Array(bytes),{headers});
}
export async function readVideoUpload(req:Request){
  const origin=new URL(process.env.APP_URL??'http://localhost:3000').origin;assert(req.headers.get('origin')===origin,'INVALID_ORIGIN',403);
  assert(req.headers.get('content-type')?.startsWith('multipart/form-data'),'MULTIPART_REQUIRED',415);
  const limit=129*1024*1024;assert(Number(req.headers.get('content-length')??0)<=limit,'VIDEO_SIZE_LIMIT',413);
  const reader=req.body?.getReader();assert(reader,'INVALID_VIDEO_FORMAT',422);const parts:Uint8Array[]=[];let length=0;
  try{for(;;){const chunk=await reader.read();if(chunk.done)break;length+=chunk.value.byteLength;assert(length<=limit,'VIDEO_SIZE_LIMIT',413);parts.push(chunk.value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  const copy=new Request(req.url,{method:'POST',headers:{'content-type':req.headers.get('content-type')!},body:Buffer.concat(parts)});
  let form:FormData;try{form=await copy.formData();}catch{assert(false,'INVALID_VIDEO_FORMAT',422);}const file=form.get('video');assert(file instanceof File&&file.name.toLowerCase().endsWith('.mp4'),'INVALID_VIDEO_FORMAT',422);
  let config:unknown;try{config=JSON.parse(String(form.get('config')??'{}'));}catch{assert(false,'INVALID_VIDEO_CONFIG',422);}return {config,name:file.name,bytes:new Uint8Array(await file.arrayBuffer())};
}
