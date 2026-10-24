import webpush from 'web-push';
import {z} from 'zod';
import {db} from './db';
import {assert} from './errors';
import {roles} from './permissions';
import type {Actor} from './access';

const subscriptionInput=z.object({endpoint:z.url().max(2048),keys:z.object({p256dh:z.string().min(20).max(500),auth:z.string().min(10).max(500)})});
const allowedHost=(host:string)=>['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com','push.apple.com','notify.windows.com'].some(domain=>host===domain||host.endsWith('.'+domain));
function configure(){const publicKey=process.env.VAPID_PUBLIC_KEY,privateKey=process.env.VAPID_PRIVATE_KEY;assert(publicKey&&privateKey,'PUSH_NOT_CONFIGURED',503);webpush.setVapidDetails(process.env.VAPID_SUBJECT??'mailto:admin@opsvision.example.test',publicKey,privateKey);return publicKey;}
export function publicPushKey(){return {publicKey:configure()};}
export async function savePushSubscription(actor:Actor,raw:unknown){
 configure();const value=subscriptionInput.parse(raw);const endpoint=new URL(value.endpoint);assert(endpoint.protocol==='https:'&&allowedHost(endpoint.hostname),'INVALID_PUSH_ENDPOINT',422);
 const record=await db.pushSubscription.upsert({where:{endpoint:value.endpoint},create:{userId:actor.id,endpoint:value.endpoint,p256dh:value.keys.p256dh,auth:value.keys.auth},update:{userId:actor.id,p256dh:value.keys.p256dh,auth:value.keys.auth}});
 return {id:record.id};
}
export async function removePushSubscription(actor:Actor,raw:unknown){const {endpoint}=z.object({endpoint:z.url()}).parse(raw);await db.pushSubscription.deleteMany({where:{endpoint,userId:actor.id}});return {removed:true};}

export async function checkOverdueWashes(){
 const now=new Date();const active=await db.wash.findMany({where:{status:{in:['WASHING','PAUSED','INSPECTION']},startedAt:{not:null},org:{status:'ACTIVE'}},select:{id:true,orgId:true,startedAt:true,estimatedMinutes:true,timeAdjustmentSeconds:true,org:{select:{name:true}},bay:{select:{name:true}}}});
 for(const wash of active){const deadline=wash.startedAt!.getTime()+wash.estimatedMinutes*60000-wash.timeAdjustmentSeconds*1000;if(now.getTime()<deadline)continue;const message=`تأخرت غسلة ${wash.org.name} - ${wash.bay?.name??'الحوض'} عن المدة المتوقعة.`;
  await db.notification.upsert({where:{sourceKey:`wash-overdue:${wash.id}:tenant`},create:{sourceKey:`wash-overdue:${wash.id}:tenant`,orgId:wash.orgId,permission:'tenant.manage_profile',type:'WASH_OVERDUE',message},update:{}});
  await db.notification.upsert({where:{sourceKey:`wash-overdue:${wash.id}:platform`},create:{sourceKey:`wash-overdue:${wash.id}:platform`,orgId:null,permission:'platform.manage_tenants',type:'WASH_OVERDUE',message},update:{}});
 }
}

export async function dispatchPushNotifications(){
 configure();
 const [subscriptions,notifications,users,memberships,customRoles]=await Promise.all([
  db.pushSubscription.findMany(),
  db.notification.findMany({where:{createdAt:{gte:new Date(Date.now()-7*86400000)}},orderBy:{createdAt:'asc'},take:500}),
  db.user.findMany({select:{id:true,disabled:true,platformRole:true,platformPermissions:true}}),
  db.membership.findMany({where:{active:true,org:{status:'ACTIVE'}},select:{userId:true,orgId:true,role:true}}),
  db.role.findMany({select:{orgId:true,name:true,permissions:true}}),
 ]);
 const userById=new Map(users.map(user=>[user.id,user]));
 for(const sub of subscriptions){const user=userById.get(sub.userId);if(!user||user.disabled)continue;
  for(const notice of notifications){if(notice.createdAt<sub.createdAt)continue;if(notice.recipientId&&notice.recipientId!==sub.userId)continue;
   let eligible=false;
   if(notice.orgId===null)eligible=user.platformRole==='SUPER_ADMIN'||user.platformRole==='PLATFORM_ADMIN'&&user.platformPermissions.includes(notice.permission);
   else {const member=memberships.find(item=>item.userId===sub.userId&&item.orgId===notice.orgId);if(member){const role=customRoles.find(item=>item.orgId===member.orgId&&item.name===member.role);eligible=(role?.permissions??roles[member.role]??[]).includes(notice.permission as never);}}
   if(!eligible)continue;
   const existing=await db.pushDelivery.findUnique({where:{subscriptionId_notificationId:{subscriptionId:sub.id,notificationId:notice.id}}});if(existing)continue;
   const delivery=await db.pushDelivery.create({data:{subscriptionId:sub.id,notificationId:notice.id}});
   try{await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify({title:'OpsVision',body:notice.message,url:'/ar/dashboard'}),{TTL:3600});await db.pushDelivery.update({where:{id:delivery.id},data:{status:'SENT'}});}
   catch(error){const code=typeof error==='object'&&error&&'statusCode'in error?Number(error.statusCode):0;await db.pushDelivery.update({where:{id:delivery.id},data:{status:'FAILED'}});if(code===404||code===410)await db.pushSubscription.deleteMany({where:{id:sub.id}});}
  }
 }
}

export async function sendTestPush(actor:Actor){
 configure(); const subscriptions=await db.pushSubscription.findMany({where:{userId:actor.id}}); let sent=0;
 for(const sub of subscriptions){try{await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify({title:'OpsVision',body:'اختبار التنبيهات ناجح',url:'/ar/dashboard'}),{TTL:300});sent++;}catch(error){const code=typeof error==='object'&&error&&'statusCode' in error?Number(error.statusCode):0;if(code===404||code===410)await db.pushSubscription.delete({where:{id:sub.id}});}}
 return {sent};
}
