import {db} from './db';
import {type Scope} from './access';
import {assert} from './errors';
import {reportingDay} from './reporting-date';
export {platformWashReportPrisma as platformWashReport} from './platform-report-prisma';

function saudiDate(){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const value=(type:string)=>parts.find(part=>part.type===type)!.value;
 return `${value('year')}-${value('month')}-${value('day')}`;
}

export async function tenantWashReport(scope:Scope,date:string){
 assert(scope.permissions.includes('reports.view'),'FORBIDDEN',403);
 const selected=date==='all'?saudiDate():date;
 const day=reportingDay(selected,'Asia/Riyadh');
 const utc=new Date(`${selected}T00:00:00Z`);
 utc.setUTCDate(utc.getUTCDate()-(utc.getUTCDay()+6)%7);
 const week=reportingDay(utc.toISOString().slice(0,10),'Asia/Riyadh');
 const [org,bays,washes]=await Promise.all([
  db.organization.findUniqueOrThrow({where:{id:scope.orgId},select:{id:true,name:true,vehicleCategories:{select:{code:true,nameAr:true,nameEn:true}}}}),
  db.washBay.findMany({where:{orgId:scope.orgId,...(scope.branchId?{branchId:scope.branchId}:{})},select:{id:true,name:true,branch:{select:{name:true}}},orderBy:{name:'asc'}}),
  db.wash.findMany({where:{orgId:scope.orgId,...(scope.branchId?{branchId:scope.branchId}:{}),status:{in:['COMPLETED','DELIVERED']},completedAt:{not:null}},select:{id:true,bayId:true,completedAt:true,startedAt:true,serviceNameAr:true,serviceNameEn:true,price:true,subtotal:true,taxAmount:true,discount:true,paymentStatus:true,vehicle:{select:{category:true}}},orderBy:{completedAt:'desc'}}),
 ]);
 const inRange=(completedAt:Date|null,start:Date,end:Date)=>!!completedAt&&completedAt>=start&&completedAt<end;
 const durations=washes.filter(wash=>wash.startedAt&&wash.completedAt).map(wash=>Math.max(0,(wash.completedAt!.getTime()-wash.startedAt!.getTime())/60000));
 const money=(items:{price:unknown;subtotal:unknown;taxAmount:unknown;discount:unknown;paymentStatus:string}[])=>({gross:items.reduce((n,w)=>n+Number(w.price as string),0),subtotal:items.reduce((n,w)=>n+Number(w.subtotal as string),0),tax:items.reduce((n,w)=>n+Number(w.taxAmount as string),0),discount:items.reduce((n,w)=>n+Number(w.discount as string),0),paid:items.filter(w=>w.paymentStatus==='PAID').reduce((n,w)=>n+Number(w.price as string),0)}); const todayRows=washes.filter(w=>inRange(w.completedAt,day.start,day.end)),weekRows=washes.filter(w=>inRange(w.completedAt,week.start,day.end));
 const categoryCounts=new Map<string,number>();
 for(const wash of washes)categoryCounts.set(wash.vehicle.category,(categoryCounts.get(wash.vehicle.category)??0)+1);
 return {date:selected,organizations:[{id:org.id,name:org.name,today:todayRows.length,week:weekRows.length,total:washes.length,financial:{today:money(todayRows),week:money(weekRows),all:money(washes)},averageMinutes:durations.length?Math.round(durations.reduce((sum,value)=>sum+value,0)/durations.length):0,
  categories:[...categoryCounts].map(([category,count])=>({category,count})),
  bays:bays.map(bay=>{const rows=washes.filter(wash=>wash.bayId===bay.id);return {id:bay.id,name:bay.name,branch:bay.branch.name,today:rows.filter(wash=>inRange(wash.completedAt,day.start,day.end)).length,week:rows.filter(wash=>inRange(wash.completedAt,week.start,day.end)).length,total:rows.length};}),
  log:washes.slice(0,20).map(wash=>({id:wash.id,bayId:wash.bayId,category:wash.vehicle.category,serviceNameAr:wash.serviceNameAr,serviceNameEn:wash.serviceNameEn,completedAt:wash.completedAt!,durationMinutes:wash.startedAt?Math.max(0,Math.round((wash.completedAt!.getTime()-wash.startedAt.getTime())/60000)):null,price:String(wash.price),subtotal:String(wash.subtotal),taxAmount:String(wash.taxAmount),discount:String(wash.discount),paymentStatus:wash.paymentStatus})),
  vehicleCategories:org.vehicleCategories}]};
}
