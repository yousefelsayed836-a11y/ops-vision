import {join} from 'node:path';
import PDFDocument from 'pdfkit';
import type {Prisma} from '@/generated/prisma/client';
import {z} from 'zod';
import {db} from './db';
import {assert} from './errors';
import {platform,tenant,type Actor} from './access';
import {isPlatformAdmin} from './permissions';
import {reportingDay} from './reporting-date';
import {vehicleCategoryLabel} from './catalog';

const input=z.object({from:z.iso.date(),to:z.iso.date(),orgId:z.uuid().optional()});
export async function reportPdf(actor:Actor,raw:unknown){
 const query=input.parse(raw);
 const start=reportingDay(query.from,'Asia/Riyadh').start;
 const end=reportingDay(query.to,'Asia/Riyadh').end;
 assert(start<end&&end.getTime()-start.getTime()<=366*86400000,'INVALID_REPORT_RANGE',422);
 const orgId=query.orgId;
 assert(orgId,'ORG_REQUIRED',422);
 let branchId:string|null=null;
 if(isPlatformAdmin(actor.platformRole))platform(actor,'platform.view_reports');
 else{
  assert(orgId,'ORG_REQUIRED',422);
  const scope=await tenant(actor,orgId);
  assert(scope.role!=='CUSTOMER'&&(scope.permissions.includes('reports.view')||scope.permissions.includes('wash.view_sessions')),'FORBIDDEN',403);
  branchId=scope.branchId;
 }
 const where:Prisma.WashWhereInput={...(orgId?{orgId}:{}),...(branchId?{branchId}:{}),status:{in:['COMPLETED','DELIVERED']},completedAt:{gte:start,lt:end}};
 const count=await db.wash.count({where});
 assert(count<=10000,'REPORT_TOO_LARGE',413);
 const washes=await db.wash.findMany({where,orderBy:{completedAt:'asc'},select:{id:true,serviceNameAr:true,startedAt:true,completedAt:true,org:{select:{name:true}},branch:{select:{name:true}},bay:{select:{name:true}},vehicle:{select:{category:true}}}});
 const font=join(process.cwd(),'assets','fonts','cairo-report.ttf');
 const doc=new PDFDocument({size:'A4',margin:42,bufferPages:true,info:{Title:'OpsVision Wash Report'}});
 const chunks:Buffer[]=[];
 doc.on('data',(chunk:Buffer)=>chunks.push(chunk));
 const done=new Promise<Buffer>((resolve,reject)=>{doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
 doc.font(font);
 const width=doc.page.width-84;
 const header=()=>{doc.rect(0,0,doc.page.width,87).fill('#f8e6ec');doc.fontSize(18).fillColor('#263f55').text('تقرير الغسيل',42,24,{width,align:'right'});doc.fontSize(9).fillColor('#477fae').text('OpsVision',42,31,{width:150});doc.moveDown();};
 header();
 doc.fontSize(11).fillColor('#263f55').text(`الفترة: ${query.from} إلى ${query.to}`,42,108,{width,align:'right'});
 doc.fontSize(11).text(`عدد الغسلات: ${washes.length}`,42,132,{width,align:'right'});
 let y=168;
 const organizations=[...new Set(washes.map(wash=>wash.org.name))];
 for(const name of organizations){
  const group=washes.filter(wash=>wash.org.name===name);
  if(y>700){doc.addPage();header();y=105;}
  doc.rect(42,y,width,32).fill('#eaf5ff');doc.fontSize(12).fillColor('#263f55').text(`${name} — ${group.length} غسلة`,50,y+6,{width:width-16,align:'right'});y+=43;
  const counts=new Map<string,number>();for(const wash of group)counts.set(wash.vehicle.category,(counts.get(wash.vehicle.category)??0)+1);
  doc.fontSize(9).fillColor('#477fae').text([...counts].map(([category,total])=>`${vehicleCategoryLabel(category,'ar')}: ${total}`).join('  |  '),42,y,{width,align:'right'});y+=28;
  for(const wash of group){
   if(y>737){doc.addPage();header();y=104;}
   const duration=wash.startedAt&&wash.completedAt?Math.max(0,Math.round((wash.completedAt.getTime()-wash.startedAt.getTime())/60000)):0;
   const stamp=new Intl.DateTimeFormat('ar-SA',{timeZone:'Asia/Riyadh',dateStyle:'short',timeStyle:'short'}).format(wash.completedAt!);
   doc.roundedRect(42,y,width,47,7).fill('#f8fafb');
   doc.fontSize(9).fillColor('#263f55').text(`${wash.bay?.name??'بدون حوض'} — ${wash.branch.name} | ${vehicleCategoryLabel(wash.vehicle.category,'ar')}`,50,y+6,{width:width-16,align:'right'});
   doc.fontSize(8).fillColor('#61788a').text(`${wash.serviceNameAr} | ${duration} دقيقة | ${stamp}`,50,y+25,{width:width-16,align:'right'});
   y+=54;
  }
  y+=10;
 }
 if(!washes.length){doc.fontSize(12).fillColor('#61788a').text('لا توجد غسلات مكتملة في الفترة المختارة.',42,y,{width,align:'right'});}
 doc.end();
 return done;
}
