import {db} from './db';
import {digest,seal,unseal} from './crypto';
import {roles} from './permissions';
export async function sendEmail(to:string,subject:string,text:string,idempotencyKey?:string){
 const key=process.env.RESEND_API_KEY;if(!key)throw new Error('EMAIL_NOT_CONFIGURED');
 const result=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{})},body:JSON.stringify({from:process.env.MAIL_FROM??'OpsVision <notifications@opsvision.org>',to:[to],subject,text}),signal:AbortSignal.timeout(15000)});
 if(!result.ok)throw new Error('EMAIL_PROVIDER_ERROR_'+result.status);
}
export async function dispatchEmails(){
 if(!process.env.RESEND_API_KEY)return;
 const [notices,users,memberships,customRoles]=await Promise.all([
 db.notification.findMany({where:{type:{not:'WASH_OVERDUE'},createdAt:{gte:new Date(Date.now()-86400000)}},orderBy:{createdAt:'asc'},take:500}),
 db.user.findMany({where:{disabled:false},select:{id:true,email:true,emailVerified:true,createdAt:true,platformRole:true,platformPermissions:true}}),
 db.membership.findMany({where:{active:true,org:{status:'ACTIVE'}},select:{userId:true,orgId:true,role:true}}),db.role.findMany({select:{orgId:true,name:true,permissions:true}})]);
 for(const notice of notices)for(const user of users){
 if(notice.createdAt<user.createdAt)continue;
 let eligible=notice.recipientId===user.id;if(notice.recipientId&&!eligible)continue;
 if(!notice.recipientId){if(notice.orgId===null)eligible=user.platformRole==='SUPER_ADMIN'||user.platformRole==='PLATFORM_ADMIN'&&user.platformPermissions.includes(notice.permission);
 else {const member=memberships.find(m=>m.userId===user.id&&m.orgId===notice.orgId);if(member){const role=customRoles.find(r=>r.orgId===member.orgId&&r.name===member.role);eligible=(role?.permissions??roles[member.role]??[]).includes(notice.permission as never);}}}
 if(!eligible)continue;
 const id=digest('notice-email:'+notice.id+':'+user.id);await db.outbox.upsert({where:{id},create:{id,orgId:notice.orgId,kind:'NOTIFICATION',recipient:user.email,status:'PENDING',encryptedPayload:seal({subject:'OpsVision — إشعار جديد',text:notice.message})},update:{}});
 }
 await db.outbox.updateMany({where:{status:{in:['PENDING','PROVIDER_UNCONFIGURED']},kind:'NOTIFICATION',id:{in:(await db.notification.findMany({where:{type:'WASH_OVERDUE'},select:{id:true}})).flatMap(notice=>users.map(user=>digest('notice-email:'+notice.id+':'+user.id)))}},data:{status:'CANCELLED'}});
 const pending=await db.outbox.findMany({where:{status:{in:['PENDING','PROVIDER_UNCONFIGURED']}},orderBy:{createdAt:'asc'},take:100});
 for(const item of pending){try{const payload=unseal(item.encryptedPayload) as {subject?:string;text?:string;token?:string;activationPath?:string};
 const base=process.env.APP_URL??process.env.BETTER_AUTH_URL??'https://opsvision.org';
 const link=payload.token?base+(payload.activationPath??'/ar/activate#')+payload.token:'';
 await sendEmail(item.recipient,payload.subject??(item.kind==='PASSWORD_RESET'?'OpsVision — إعادة تعيين كلمة المرور':'OpsVision — تفعيل الحساب'),payload.text??('افتح الرابط التالي لإكمال طلبك:\n'+link+'\nإذا لم تطلب ذلك، تجاهل الرسالة.'),'outbox-'+item.id);
 await db.outbox.update({where:{id:item.id},data:{status:'SENT'}});
 }catch(error){console.error('Email delivery failed',item.id,error instanceof Error?error.message:'unknown');}}
}
