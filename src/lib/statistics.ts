import {db} from './db';
import {assert} from './errors';
import type {Scope} from './access';
import {reportingDay} from './reporting-date';
export type DailyStatistics={orgId:string;date:string;timezone:string;sessions:number;active:number;started:number;completed:number;available:number;revenue?:string;serviceCounts:{serviceId:string;count:number}[]};
export async function dailyStatistics(scope:Scope,date:string):Promise<DailyStatistics>{
 assert(['wash.view_sessions','reports.view','finance.view_revenue'].some(p=>scope.permissions.includes(p)),'FORBIDDEN',403);
 const branch=await db.branch.findFirst({where:{orgId:scope.orgId,...(scope.branchId?{id:scope.branchId}:{})},orderBy:{createdAt:'asc'},select:{timezone:true}});
 const timezone=branch?.timezone??'Asia/Riyadh',range=date==='all'?null:reportingDay(date,timezone),period=range?{gte:range.start,lt:range.end}:undefined;
 const where={orgId:scope.orgId,...(scope.branchId?{branchId:scope.branchId}:{})};
 const [sessions,active,started,completed,available,counts,revenue]=await Promise.all([
  db.wash.count({where:{...where,createdAt:period}}),db.wash.count({where:{...where,status:{notIn:['COMPLETED','DELIVERED','CANCELLED','BOOKED']}}}),db.wash.count({where:{...where,startedAt:period??{not:null}}}),db.wash.count({where:{...where,completedAt:period??{not:null}}}),
  db.washBay.count({where:{...where,status:'AVAILABLE',activeWashId:null,branch:{active:true}}}),
  db.wash.groupBy({by:['serviceId'],where:{...where,createdAt:period},_count:{_all:true}}),
  scope.permissions.includes('finance.view_revenue')?db.payment.aggregate({where:{orgId:scope.orgId,createdAt:period,...(scope.branchId?{wash:{branchId:scope.branchId}}:{})},_sum:{amount:true}}):null
 ]);
 return {orgId:scope.orgId,date,timezone,sessions,active,started,completed,available,serviceCounts:counts.map(c=>({serviceId:c.serviceId,count:c._count._all})),...(revenue?{revenue:revenue._sum.amount?.toString()??'0'}:{})};
}
