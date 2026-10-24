import {hashPassword} from 'better-auth/crypto';
import {z} from 'zod';
import {db} from './db';
import {assert} from './errors';
import {transaction,audit} from './transactions';
import {email,password} from './validation';
import {platform,type Actor} from './access';
import {randomUUID} from 'node:crypto';

function superAdmin(actor:Actor){platform(actor,'platform.manage_users');}
export async function listAccounts(actor:Actor){
 superAdmin(actor);
 return db.user.findMany({select:{id:true,name:true,email:true,platformRole:true,disabled:true,memberships:{select:{role:true,org:{select:{name:true}}}}},orderBy:{createdAt:'desc'},take:500});
}
export async function updateAccountCredentials(actor:Actor,id:string,raw:unknown){
 superAdmin(actor);
 const data=z.object({email:email.optional(),password:password.optional()}).refine(value=>value.email!==undefined||value.password!==undefined).parse(raw);
 const hashed=data.password?await hashPassword(data.password):undefined;
 return transaction(async tx=>{
  const user=await tx.user.findUnique({where:{id}});assert(user,'NOT_FOUND',404);
  if(data.email&&data.email!==user.email){
   assert(!(await tx.user.findUnique({where:{email:data.email}})),'EMAIL_EXISTS',409);
   await tx.user.update({where:{id},data:{email:data.email,emailVerified:false}});
   await tx.invitation.updateMany({where:{email:user.email,usedAt:null},data:{revokedAt:new Date()}});
  }
  if(hashed){
   const changed=await tx.account.updateMany({where:{userId:id,providerId:'credential'},data:{password:hashed}});
   if(changed.count===0)await tx.account.create({data:{id:randomUUID(),userId:id,accountId:id,providerId:'credential',password:hashed}});
  }
  await tx.session.deleteMany({where:{userId:id}});
  await audit(tx,actor.id,'account.credentials_updated','user',id,undefined,{emailChanged:!!data.email&&data.email!==user.email,passwordChanged:!!hashed});
  return {id,email:data.email??user.email};
 });
}
