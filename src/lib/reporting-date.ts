import {assert} from './errors';
export function reportingDay(date:string,timezone:string){
 assert(/^\d{4}-\d{2}-\d{2}$/.test(date),'INVALID_REPORT_DATE',422);
 const day=Date.parse(date+'T00:00:00Z');assert(Number.isFinite(day)&&new Date(day).toISOString().slice(0,10)===date,'INVALID_REPORT_DATE',422);
 let formatter:Intl.DateTimeFormat;try{formatter=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'});}catch{assert(false,'INVALID_TIMEZONE',422);}
 const localDate=(value:number)=>{const parts=formatter.formatToParts(value),part=(type:string)=>parts.find(p=>p.type===type)!.value;return `${part('year')}-${part('month')}-${part('day')}`;};
 const boundary=(target:string,utc:number)=>{let low=utc-36*3600000,high=utc+36*3600000;while(low<high){const mid=Math.floor((low+high)/2);if(localDate(mid)<target)low=mid+1;else high=mid;}return low;};
 const start=boundary(date,day);assert(localDate(start)===date,'INVALID_REPORT_DATE',422);
 const next=new Date(day+86400000).toISOString().slice(0,10),end=boundary(next,day+86400000);
 return {start:new Date(start),end:new Date(end)};
}
