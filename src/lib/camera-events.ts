import {z} from 'zod';
import {recordCameraVisit} from './camera-visits';
import type {Tx} from './transactions';
import {emit,processEvent} from './automation';
import {db} from './db';
import {assert} from './errors';
import type {VideoReport} from './video-analysis';
const gateEvent=z.object({confidence:z.number().min(0).max(1).default(0),type:z.enum(['vehicle.entered_bay','vehicle.exited_bay']),videoSeconds:z.number().finite().nonnegative(),confirmedAtSeconds:z.number().finite().nonnegative(),bayId:z.uuid().nullable().optional()});
export async function emitCameraGateEvents(tx:Tx,job:{id:string;orgId:string;branchId:string;cameraId:string|null;sourceSha256:string;config:unknown},report:VideoReport){
 if(!report.automation)return [];
 const config=job.config as {bayId?:string};const events=z.array(gateEvent).max(1000).parse(report.automation.events);const ids:string[]=[];
 for(const event of [...events].sort((a,b)=>a.videoSeconds-b.videoSeconds)){
  assert(event.videoSeconds<=report.video.durationSeconds&&event.confirmedAtSeconds>=event.videoSeconds&&event.confirmedAtSeconds<=report.video.durationSeconds+1,'INVALID_CAMERA_EVENT',422);
  const mappedBayId=event.bayId??config.bayId;
  if(mappedBayId)assert(await tx.washBay.findFirst({where:{id:mappedBayId,orgId:job.orgId,branchId:job.branchId}}),'INVALID_CAMERA_BAY',422);
  await recordCameraVisit(tx,job,report,event);
  const normalized=event.type==='vehicle.entered_bay'?'vehicle.entered_zone':'vehicle.exited_zone';
  const stored=await emit(tx,{orgId:job.orgId,key:`camera-gate:${job.cameraId??mappedBayId??'unassigned'}:${mappedBayId??'none'}:${job.sourceSha256}:${event.type}:${event.videoSeconds.toFixed(3)}`,type:normalized,source:'VIDEO_FILE',payload:{analysisId:job.id,branchId:job.branchId,cameraId:job.cameraId,bayId:mappedBayId??null,zoneKind:'WASH_BAY',eventMeaning:event.type,videoSeconds:event.videoSeconds,confirmedAtSeconds:event.confirmedAtSeconds,replay:true,confidence:event.confidence,engine:report.automation.engine}});ids.push(stored.id);
 }
 return ids;
}

export async function processDueCameraGateEvents(){
 const rows=await db.automationEvent.findMany({where:{source:'VIDEO_FILE',type:{in:['vehicle.entered_zone','vehicle.exited_zone']},status:{in:['PENDING','RETRY']},nextAttemptAt:{lte:new Date()}},orderBy:{createdAt:'asc'},take:20,select:{id:true}});
 for(const row of rows)await processEvent(row.id);return rows.length;
}
