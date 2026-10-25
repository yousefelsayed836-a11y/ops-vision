import {z} from 'zod';
import {db} from './db';
import {tenant,platform,type Actor} from './access';
import {assert} from './errors';
import {transaction,audit} from './transactions';
import {digest} from './crypto';
import {CONTRACT_VERSION,CONTRACT_TERMS} from './contract-terms';
export async function accountContract(actor:Actor,orgId:string){
 await tenant(actor,orgId);
 const acceptance=await db.contractAcceptance.findUnique({where:{orgId_userId_version:{orgId,userId:actor.id,version:CONTRACT_VERSION}}});
 return {version:CONTRACT_VERSION,terms:CONTRACT_TERMS,acceptance};
}
export async function requireContract(actor:Actor,orgId:string){
 if(['SUPER_ADMIN','PLATFORM_ADMIN'].includes(actor.platformRole))return;
 const scope=await tenant(actor,orgId);if(scope.role==='CUSTOMER')return;
 assert(await db.contractAcceptance.findUnique({where:{orgId_userId_version:{orgId,userId:actor.id,version:CONTRACT_VERSION}}}),'CONTRACT_REQUIRED',403);
}
export async function signContract(actor:Actor,orgId:string,raw:unknown){
 await tenant(actor,orgId);
 const input=z.object({version:z.literal(CONTRACT_VERSION),signerName:z.string().trim().min(2).max(120),accepted:z.literal(true)}).parse(raw);
 return transaction(async tx=>{
  const [user,org]=await Promise.all([tx.user.findUniqueOrThrow({where:{id:actor.id}}),tx.organization.findUniqueOrThrow({where:{id:orgId}})]);
  const acceptance=await tx.contractAcceptance.upsert({where:{orgId_userId_version:{orgId,userId:actor.id,version:input.version}},create:{orgId,userId:actor.id,version:input.version,signerName:input.signerName,signerEmail:user.email,organizationName:org.name,terms:CONTRACT_TERMS,termsHash:digest(JSON.stringify(CONTRACT_TERMS))},update:{}});
  await tx.notification.upsert({where:{sourceKey:'contract-signed:'+acceptance.id},create:{sourceKey:'contract-signed:'+acceptance.id,type:'CONTRACT_SIGNED',orgId:null,permission:'platform.manage_tenants',message:'تم توقيع اتفاقية مغسلة '+org.name+' بواسطة '+acceptance.signerName+' ('+user.email+').'},update:{}});
  await audit(tx,actor.id,'contract.accepted','contract',acceptance.id,orgId,{version:input.version,termsHash:acceptance.termsHash});
  return {version:CONTRACT_VERSION,terms:CONTRACT_TERMS,acceptance};
 });
}
export async function listContracts(actor:Actor){platform(actor,'platform.manage_tenants');return db.contractAcceptance.findMany({orderBy:{acceptedAt:'desc'},take:500});}
