import {z} from 'zod';
import {db} from './db';
import {platform,tenant,type Actor} from './access';
import {assert} from './errors';
import {audit,transaction} from './transactions';

export async function savePublicNotice(actor:Actor,orgId:string,raw:unknown,platformMode=false){
 if(platformMode)platform(actor,'platform.manage_tenants');else await tenant(actor,orgId,'tenant.manage_profile');
 const {message}=z.object({message:z.string().trim().max(240)}).parse(raw);
 const org=await db.organization.findFirst({where:{id:orgId,status:'ACTIVE'},select:{id:true}});
 assert(org,'NOT_FOUND',404);
 return transaction(async tx=>{
  const updated=await tx.organization.update({where:{id:orgId},data:{publicNotice:message},select:{id:true,publicNotice:true}});
  await audit(tx,actor.id,'organization.public_notice_updated','organization',orgId,orgId);
  return updated;
 });
}
