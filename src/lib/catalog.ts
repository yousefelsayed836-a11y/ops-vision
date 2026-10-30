// Read from the user-authorized reference UI on 2026-10-18. No prices were copied.
export const washCatalog=[
 {ar:'صابون',en:'Soap'}, {ar:'غسيل خارجي',en:'Exterior wash'},
 {ar:'غسيل داخلي',en:'Interior wash'}, {ar:'تمسيح',en:'Wipe down'},
 {ar:'داخل/خارج',en:'Interior / exterior'}, {ar:'داخل',en:'Interior'},
 {ar:'خارج',en:'Exterior'}, {ar:'ماء',en:'Water'}, {ar:'سجاد',en:'Carpet',unit:'meter'},
] as const;
export const vehicleCategories=['SEDAN','SUV','FULL_SIZE_SUV','MOTORCYCLE','BICYCLE','OTHER'] as const;
export const builtinVehicleCategories=['SEDAN','SUV','FULL_SIZE_SUV','MOTORCYCLE','BICYCLE','HATCHBACK','CROSSOVER','PICKUP','VAN','MINIBUS','LARGE'] as const;
const vehicleLabels:Record<string,[string,string]>={ALL:['الكل','All'],OTHER:['خدمة أخرى','Other service'],SEDAN:['سيدان','Sedan'],SUV:['SUV','SUV'],MOTORCYCLE:['دراجة نارية','Motorcycle'],BICYCLE:['عجلة','Bicycle'],FULL_SIZE_SUV:['4×4','4×4'],HATCHBACK:['هاتشباك','Hatchback'],CROSSOVER:['كروس أوفر CUV','Crossover / CUV'],PICKUP:['بيك أب','Pickup'],VAN:['فان','Van'],MINIBUS:['ميني باص','Minibus'],LARGE:['مركبة كبيرة','Large vehicle']};
export function vehicleCategoryLabel(value:string,locale:string,custom:readonly {code:string;nameAr:string;nameEn:string}[]=[]){return custom.find(item=>item.code===value)?.[locale==='ar'?'nameAr':'nameEn']??vehicleLabels[value]?.[locale==='ar'?0:1]??value;}
export function servicePriceForCategory(service:{price:string;pricingRules?:readonly {category:string;size:string;price:string}[]},category:string,size='MEDIUM'){
 const matches=(service.pricingRules??[]).filter(rule=>(rule.category===category||rule.category==='ALL')&&(rule.size===size||rule.size==='ALL'));
 matches.sort((a,b)=>(Number(b.category!=='ALL')*2+Number(b.size!=='ALL'))-(Number(a.category!=='ALL')*2+Number(a.size!=='ALL')));
 return matches[0]?.price??service.price;
}
export function serviceDurationForCategory(service:{durationMinutes:number;pricingRules?:readonly {category:string;size:string;durationMinutes?:number|null}[]},category:string,size='MEDIUM'){
 const matches=(service.pricingRules??[]).filter(rule=>(rule.category===category||rule.category==='ALL')&&(rule.size===size||rule.size==='ALL'));
 matches.sort((a,b)=>(Number(b.category!=='ALL')*2+Number(b.size!=='ALL'))-(Number(a.category!=='ALL')*2+Number(a.size!=='ALL')));
 return matches[0]?.durationMinutes??service.durationMinutes;
}
