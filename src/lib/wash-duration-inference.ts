export type DurationCandidate={id:string;name:string;minutes:number};

// Time is only supporting evidence: close durations cannot identify a service reliably.
export function inferServiceFromDuration(observedSeconds:number,candidates:DurationCandidate[]){
 if(!Number.isFinite(observedSeconds)||observedSeconds<120)return {service:null,requiresReview:true,reason:'INSUFFICIENT_DURATION'};
 const observedMinutes=observedSeconds/60;
 const ranked=candidates.filter(item=>item.minutes>0).map(item=>({...item,difference:Math.abs(item.minutes-observedMinutes)})).sort((a,b)=>a.difference-b.difference);
 const first=ranked[0],second=ranked[1];
 if(!first||first.difference>Math.max(5,first.minutes*.3))return {service:null,requiresReview:true,reason:'NO_MATCH'};
 if(second&&second.difference-first.difference<Math.max(4,first.minutes*.2))return {service:null,requiresReview:true,reason:'AMBIGUOUS_DURATION'};
 return {service:{id:first.id,name:first.name},requiresReview:false,reason:'DURATION_MATCH'};
}
