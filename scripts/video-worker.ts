import 'dotenv/config';
import {videoAnalysisEnabled} from '../src/lib/features';
import {spawn} from 'node:child_process';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {db} from '../src/lib/db';
import {videoDirectory,type VideoReport} from '../src/lib/video-analysis';
import {emitCameraGateEvents,processDueCameraGateEvents} from '../src/lib/camera-events';
import {emit} from '../src/lib/automation';
import {transaction} from '../src/lib/transactions';
import type {Prisma} from '../src/generated/prisma/client';
let running=true;process.on('SIGINT',()=>{running=false;});process.on('SIGTERM',()=>{running=false;});
async function processOne(){
  const pending=await db.videoAnalysis.findFirst({where:{status:'QUEUED'},orderBy:{createdAt:'asc'}});if(!pending)return false;
  const claimed=await db.videoAnalysis.updateMany({where:{id:pending.id,status:'QUEUED'},data:{status:'PROCESSING',lockedAt:new Date(),attempts:{increment:1}}});if(!claimed.count)return true;
  try{
    const folder=videoDirectory(pending.id);await writeFile(join(folder,'config.json'),JSON.stringify(pending.config));
    const python=process.env.OPSVISION_PYTHON??(process.platform==='win32'?'python':'python3');
    await new Promise<void>((accept,reject)=>{
      const child=spawn(python,[resolve('workers/video_analysis/analyze.py'),'--input',join(folder,'source.mp4'),'--output',folder,'--config',join(folder,'config.json')],{cwd:process.cwd(),shell:false,windowsHide:true,stdio:['ignore','ignore','ignore'],timeout:1850000});
      child.on('error',()=>reject(new Error('VIDEO_RUNTIME_UNAVAILABLE')));child.on('close',code=>code===0?accept():reject(new Error('VIDEO_ANALYSIS_FAILED')));
    });
    if((await stat(join(folder,'report.json'))).size>8*1024*1024)throw new Error('VIDEO_RESULT_LIMIT');
    const report=JSON.parse(await readFile(join(folder,'report.json'),'utf8')) as VideoReport;
    if(report.source!=='VIDEO_FILE'||!Array.isArray(report.tracks)||!Number.isFinite(report.video?.durationSeconds))throw new Error('VIDEO_RESULT_INVALID');
    await transaction(async tx=>{
      await tx.videoAnalysis.update({where:{id:pending.id},data:{status:'COMPLETED',result:report as unknown as Prisma.InputJsonValue,completedAt:new Date(),errorCode:null}});
      await emitCameraGateEvents(tx,pending,report);
      await emit(tx,{orgId:pending.orgId,key:`video-complete:${pending.id}`,type:'video.analysis_completed',source:'VIDEO_FILE',payload:{analysisId:pending.id,branchId:pending.branchId,cameraId:pending.cameraId,detectedTracks:report.detectedTracks,confidence:report.tracks.length?Math.min(...report.tracks.map(t=>t.confidence)):0}});
    });console.log(JSON.stringify({event:'video.completed',id:pending.id,tracks:report.detectedTracks}));
  }catch(error){
    await db.videoAnalysis.update({where:{id:pending.id},data:{status:'FAILED',errorCode:error instanceof Error?error.message:'VIDEO_ANALYSIS_FAILED',completedAt:new Date()}});
    const message=`تعذر تحليل تسجيل الكاميرا ${pending.sourceName}. راجع التسجيل وإعداد الحوض.`;
    for(const [audience,orgId,permission] of [['platform',null,'platform.manage_tenants'],['owner',pending.orgId,'tenant.manage_profile'],['assistant',pending.orgId,'wash.view_sessions']] as const){
      await db.notification.upsert({where:{sourceKey:`camera-failed:${pending.id}:${audience}`},create:{sourceKey:`camera-failed:${pending.id}:${audience}`,orgId,permission,type:'CAMERA_FAILED',message},update:{}});
    }
    console.error(JSON.stringify({event:'video.failed',id:pending.id}));
  }
  return true;
}
async function main(){
  if(!videoAnalysisEnabled){console.log("Video analysis disabled in operations-only mode.");return;}
  // Recover crashed workers without silently retrying permanently invalid input forever.
  await db.videoAnalysis.updateMany({where:{status:'PROCESSING',lockedAt:{lt:new Date(Date.now()-15*60000)},attempts:{lt:2}},data:{status:'QUEUED',lockedAt:null}});
  await db.videoAnalysis.updateMany({where:{status:'PROCESSING',lockedAt:{lt:new Date(Date.now()-15*60000)},attempts:{gte:2}},data:{status:'FAILED',errorCode:'VIDEO_WORKER_INTERRUPTED',completedAt:new Date()}});
  while(running){await processDueCameraGateEvents();if(!await processOne())await new Promise(resolve=>setTimeout(resolve,2000));if(process.argv.includes('--once'))break;}
}
main().catch(()=>{console.error('Video worker failed; no source data logged.');process.exitCode=1;}).finally(()=>db.$disconnect());
