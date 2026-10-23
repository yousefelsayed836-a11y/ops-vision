import {randomBytes} from 'node:crypto';
import {hashPassword,verifyPassword} from 'better-auth/crypto';
import {z} from 'zod';
import {db} from './db';
import {assert} from './errors';
import {branchScope,type Scope} from './access';
import {token,digest} from './crypto';
import {transaction,audit} from './transactions';
export async function issueTracking(scope:Scope,washId:string){
 assert(scope.permissions.includes('tenant.manage_customers'),'FORBIDDEN',403);z.uuid().parse(washId);
 const password=randomBytes(12).toString('base64url'),passwordHash=await hashPassword(password);
 const result=await transaction(async tx=>{
  const wash=await tx.wash.findFirst({where:{id:washId,orgId:scope.orgId}});assert(wash,'NOT_FOUND',404);branchScope(scope,wash.branchId);
  await tx.customerTracking.updateMany({where:{washId,orgId:scope.orgId,revokedAt:null},data:{revokedAt:new Date()}});
  const link=await tx.customerTracking.create({data:{orgId:scope.orgId,washId,passwordHash,expiresAt:new Date(Date.now()+7*86400000)}});
  await audit(tx,scope.actor.id,'customer.tracking_issued','wash',washId,scope.orgId);return link;
 });
 return {id:result.id,url:`${process.env.APP_URL??'http://localhost:3000'}/ar/track?id=${result.id}`,password,expiresAt:result.expiresAt};
}
export async function trackingLogin(id:string,raw:unknown){
 z.uuid().parse(id);const data=z.object({password:z.string().min(1).max(128)}).parse(raw);
 const link=await db.customerTracking.findFirst({where:{id,revokedAt:null,expiresAt:{gt:new Date()},wash:{org:{status:'ACTIVE'}}}});
 assert(link&&await verifyPassword({hash:link.passwordHash,password:data.password}),'INVALID_TRACKING_ACCESS',401);
 const session=token();await db.customerTracking.update({where:{id},data:{sessionHash:session.hash,sessionExpiresAt:new Date(Math.min(link.expiresAt.getTime(),Date.now()+24*3600000))}});
 return session.raw;
}
export async function trackingStatus(id:string,session:string){
 z.uuid().parse(id);assert(session.length>=32,'INVALID_TRACKING_ACCESS',401);
 const link=await db.customerTracking.findFirst({where:{id,sessionHash:digest(session),sessionExpiresAt:{gt:new Date()},expiresAt:{gt:new Date()},revokedAt:null,wash:{org:{status:'ACTIVE'}}},include:{wash:{include:{customerProfile:{select:{name:true}},org:{select:{name:true}},branch:{select:{name:true}},history:{orderBy:{createdAt:'asc'},select:{toStatus:true,createdAt:true}}}}}});
 assert(link,'INVALID_TRACKING_ACCESS',401);const wash=link.wash;
 return {customerName:wash.customerProfile?.name??null,organization:wash.org.name,branch:wash.branch.name,status:wash.status,serviceAr:wash.serviceNameAr,serviceEn:wash.serviceNameEn,startedAt:wash.startedAt,completedAt:wash.completedAt,history:wash.history};
}
