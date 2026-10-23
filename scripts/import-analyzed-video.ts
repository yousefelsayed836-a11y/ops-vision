import 'dotenv/config';
import {createHash} from 'node:crypto';
import {readFile,copyFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {db} from '../src/lib/db';
import {tenant} from '../src/lib/access';
import {queueVideo,videoDirectory,type VideoReport} from '../src/lib/video-analysis';
import {emitCameraGateEvents,processDueCameraGateEvents} from '../src/lib/camera-events';
import {emit} from '../src/lib/automation';
import {transaction,audit} from '../src/lib/transactions';
import type {Prisma} from '../src/generated/prisma/client';
// Local operator utility: persists an already-computed report without running inference twice.
async function main(){
 const [email,orgId,source,analysis,configPath,displayName]=process.argv.slice(2);if(!configPath)throw Error('Expected actor email, org, source, analysis directory and config file');
 const actor=await db.user.findUniqueOrThrow({where:{email}});const scope=await tenant({id:actor.id,platformRole:actor.platformRole},orgId,'video.analyze');
 const config=JSON.parse(await readFile(configPath,'utf8'));const bytes=await readFile(source);
 const reportPath=join(analysis,'report.json');if((await stat(reportPath)).size>8*1024*1024)throw Error('VIDEO_RESULT_LIMIT');
 const report=JSON.parse(await readFile(reportPath,'utf8')) as VideoReport;
 if(report.source!=='VIDEO_FILE'||!Array.isArray(report.tracks)||!Number.isFinite(report.video?.durationSeconds))throw Error('INVALID_REPORT');
 if(report.sourceSha256&&report.sourceSha256!==createHash('sha256').update(bytes).digest('hex'))throw Error('REPORT_SOURCE_MISMATCH');
 for(const track of report.tracks)if(!/^V\d{3,5}\.jpg$/.test(track.evidenceFile))throw Error('INVALID_EVIDENCE');
 const job=await queueVideo(scope,config,displayName??source.split(/[\\/]/).at(-1)!,bytes,true);
 try{
  const folder=videoDirectory(job.id);await copyFile(reportPath,join(folder,'report.json'));
  for(const track of report.tracks)await copyFile(join(analysis,track.evidenceFile),join(folder,track.evidenceFile));
  await transaction(async tx=>{
   await tx.videoAnalysis.update({where:{id:job.id},data:{status:'COMPLETED',lockedAt:null,attempts:1,completedAt:new Date(),result:report as unknown as Prisma.InputJsonValue}});
   await audit(tx,actor.id,'video.local_report_imported','video_analysis',job.id,orgId);
   const storedJob=await tx.videoAnalysis.findUniqueOrThrow({where:{id:job.id}});await emitCameraGateEvents(tx,storedJob,report);
   await emit(tx,{orgId,key:`video-complete:${job.id}`,type:'video.analysis_completed',source:'VIDEO_FILE',payload:{analysisId:job.id,branchId:config.branchId,bayId:config.bayId,detectedTracks:report.detectedTracks}});
  });
  await processDueCameraGateEvents();
  console.log(JSON.stringify({id:job.id,tracks:report.detectedTracks,zoneSummary:report.zoneSummary}));
 }catch(error){await db.videoAnalysis.update({where:{id:job.id},data:{status:'FAILED',lockedAt:null,errorCode:'LOCAL_REPORT_IMPORT_FAILED'}});throw error;}
}
main().catch(()=>{console.error('Local report import failed. No credentials or source content logged.');process.exitCode=1;}).finally(()=>db.$disconnect());
