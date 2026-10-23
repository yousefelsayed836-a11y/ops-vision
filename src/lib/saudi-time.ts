export const SAUDI_TIME_ZONE='Asia/Riyadh';

export function saudiTime(value:string|Date,locale:string){
 return new Intl.DateTimeFormat(locale,{timeZone:SAUDI_TIME_ZONE,hour:'2-digit',minute:'2-digit'}).format(new Date(value));
}

export function saudiDate(value:string|Date,locale:string){
 return new Intl.DateTimeFormat(locale,{timeZone:SAUDI_TIME_ZONE,dateStyle:'medium'}).format(new Date(value));
}

export function saudiDateTime(value:string|Date,locale:string){
 return new Intl.DateTimeFormat(locale,{timeZone:SAUDI_TIME_ZONE,dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
}
