import {db} from './db';
import {platform,type Actor} from './access';
import {reportingDay} from './reporting-date';

function saudiDate(){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const value=(type:string)=>parts.find(part=>part.type===type)!.value;
 return `${value('year')}-${value('month')}-${value('day')}`;
}

export async function platformWashReportPrisma(actor:Actor,date:string){
 platform(actor,'platform.view_reports');
 const selected=date==='all'?saudiDate():date;
 const day=reportingDay(selected,'Asia/Riyadh');
 const utc=new Date(`${selected}T00:00:00Z`);
 utc.setUTCDate(utc.getUTCDate()-(utc.getUTCDay()+6)%7);
 const week=reportingDay(utc.toISOString().slice(0,10),'Asia/Riyadh');
 const orgs=await db.organization.findMany({where:{status:'ACTIVE'},select:{id:true,name:true,vehicleCategories:{select:{code:true,nameAr:true,nameEn:true}},bays:{select:{id:true,name:true,branch:{select:{name:true}}},orderBy:{name:'asc'}}},orderBy:{name:'asc'}});
 const washes=await db.wash.findMany({where:{orgId:{in:orgs.map(org=>org.id)},status:{in:['COMPLETED','DELIVERED']},completedAt:{not:null}},select:{id:true,orgId:true,bayId:true,completedAt:true,startedAt:true,serviceNameAr:true,serviceNameEn:true,price:true,subtotal:true,taxAmount:true,discount:true,paymentStatus:true,vehicle:{select:{category:true}}},orderBy:{completedAt:'desc'}});
 const inRange=(value:Date|null,start:Date,end:Date)=>!!value&&value>=start&&value<end;
 return {date:selected,organizations:orgs.map(org=>{
  const rows=washes.filter(wash=>wash.orgId===org.id);
  const durations=rows.filter(wash=>wash.startedAt&&wash.completedAt).map(wash=>Math.max(0,(wash.completedAt!.getTime()-wash.startedAt!.getTime())/60000));
  const money=(items:{price:unknown;subtotal:unknown;taxAmount:unknown;discount:unknown;paymentStatus:string}[])=>({gross:items.reduce((n,w)=>n+Number(w.price as string),0),subtotal:items.reduce((n,w)=>n+Number(w.subtotal as string),0),tax:items.reduce((n,w)=>n+Number(w.taxAmount as string),0),discount:items.reduce((n,w)=>n+Number(w.discount as string),0),paid:items.filter(w=>w.paymentStatus==='PAID').reduce((n,w)=>n+Number(w.price as string),0)});
  const todayRows=rows.filter(wash=>inRange(wash.completedAt,day.start,day.end)),weekRows=rows.filter(wash=>inRange(wash.completedAt,week.start,day.end));
  const categories=new Map<string,number>();
  for(const wash of rows)categories.set(wash.vehicle.category,(categories.get(wash.vehicle.category)??0)+1);
  return {id:org.id,name:org.name,today:todayRows.length,week:weekRows.length,total:rows.length,financial:{today:money(todayRows),week:money(weekRows),all:money(rows)},averageMinutes:durations.length?Math.round(durations.reduce((sum,value)=>sum+value,0)/durations.length):0,
   categories:[...categories].map(([category,count])=>({category,count})),
   bays:org.bays.map(bay=>{const bayRows=rows.filter(wash=>wash.bayId===bay.id);return {id:bay.id,name:bay.name,branch:bay.branch.name,today:bayRows.filter(wash=>inRange(wash.completedAt,day.start,day.end)).length,week:bayRows.filter(wash=>inRange(wash.completedAt,week.start,day.end)).length,total:bayRows.length};}),
   log:rows.slice(0,20).map(wash=>({id:wash.id,bayId:wash.bayId,category:wash.vehicle.category,serviceNameAr:wash.serviceNameAr,serviceNameEn:wash.serviceNameEn,completedAt:wash.completedAt!,durationMinutes:wash.startedAt?Math.max(0,Math.round((wash.completedAt!.getTime()-wash.startedAt.getTime())/60000)):null,price:String(wash.price),subtotal:String(wash.subtotal),taxAmount:String(wash.taxAmount),discount:String(wash.discount),paymentStatus:wash.paymentStatus})),
   vehicleCategories:org.vehicleCategories};
 })};
}
