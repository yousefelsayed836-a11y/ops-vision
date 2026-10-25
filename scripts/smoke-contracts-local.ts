/* eslint-disable @typescript-eslint/no-explicit-any -- test-only bridge for the in-memory PostgreSQL driver */
// In-memory SQL tests only. This harness never reads a production database URL.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import pg from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../src/generated/prisma/client';
const memory=await PGlite.create();
for(const dir of (await readdir('prisma/migrations')).sort()){if(dir==='migration_lock.toml')continue;await memory.exec(await readFile('prisma/migrations/'+dir+'/migration.sql','utf8'));}
const pool=new pg.Pool();
const query=async(input:any,params?:unknown[])=>{const text=typeof input==='string'?input:input.text;const values=typeof input==='string'?(params??[]):(input.values??[]);const options:any={rowMode:typeof input==='string'?undefined:input.rowMode,parsers:{114:(v:string)=>v,3802:(v:string)=>v,1114:(v:string)=>v,1184:(v:string)=>v,1700:(v:string)=>v,20:(v:string)=>v}};const result:any=await memory.query(text,values,options);return {...result,rowCount:result.affectedRows??result.rows.length,command:text.split(' ')[0]};};
(pool as any).query=query;
(pool as any).connect=async()=>({query,release:()=>{},on:()=>{},removeListener:()=>{}});
const db=new PrismaClient({adapter:new PrismaPg(pool)});
(globalThis as any).opsvisionDb=db;
process.env.BETTER_AUTH_SECRET=randomBytes(48).toString('hex');process.env.BETTER_AUTH_URL='http://localhost:3000';process.env.APP_ENV='development';
try{
const {hashPassword}=await import('better-auth/crypto');
const {auth}=await import('../src/lib/auth');
const {updateAccountCredentials}=await import('../src/lib/account-admin');
const {accountContract,signContract,requireContract}=await import('../src/lib/contracts');
const {CONTRACT_VERSION}=await import('../src/lib/contract-terms');
const {quickWash}=await import('../src/lib/quick-wash');
const {addWashExtraService,removeWashExtraService}=await import('../src/lib/wash-extras');
const {roles}=await import('../src/lib/permissions');
const id=randomUUID(),orgId=randomUUID(),ownerId=randomUUID();const email='account-test@example.test';const oldPassword='Old-pass8',newPassword='Changed-password-456!';
await db.user.create({data:{id,name:'Local admin',email:'admin-test@example.test',platformRole:'SUPER_ADMIN'}});
await db.user.create({data:{id:ownerId,name:'Local wash owner',email,emailVerified:false,accounts:{create:{id:randomUUID(),accountId:ownerId,providerId:'credential',password:await hashPassword(oldPassword)}}}});
await db.organization.create({data:{id:orgId,name:'Isolated test wash',slug:'isolated-'+orgId,defaultWashMinutes:27}});
await db.membership.create({data:{userId:ownerId,orgId,role:'OWNER'}});
const admin={id,platformRole:'SUPER_ADMIN'},owner={id:ownerId,platformRole:'NONE'};
async function login(password:string){return auth.handler(new Request('http://localhost:3000/api/auth/sign-in/email',{method:'POST',headers:{'content-type':'application/json',origin:'http://localhost:3000'},body:JSON.stringify({email,password})}));}
assert.equal((await login(oldPassword)).status,200);console.log('PASS login without verification');
await updateAccountCredentials(admin,ownerId,{password:newPassword});assert.equal(await db.session.count({where:{userId:ownerId}}),0);assert.equal((await login(oldPassword)).status,401);assert.equal((await login(newPassword)).status,200);console.log('PASS actual auth login after admin password reset and session revocation');
const forbidden=await auth.handler(new Request('http://localhost:3000/api/auth/change-password',{method:'POST',headers:{'content-type':'application/json',origin:'http://localhost:3000'},body:'{}'}));assert.notEqual(forbidden.status,200);console.log('PASS public password change endpoint blocked');
await assert.rejects(()=>requireContract(owner,orgId),{code:'CONTRACT_REQUIRED'});
await assert.rejects(()=>signContract(owner,orgId,{version:CONTRACT_VERSION,signerName:'Tester',accepted:false}));
const accepted=await signContract(owner,orgId,{version:CONTRACT_VERSION,signerName:'Test Owner',accepted:true});assert(accepted.acceptance);await requireContract(owner,orgId);await signContract(owner,orgId,{version:CONTRACT_VERSION,signerName:'Changed signature',accepted:true});assert.equal(await db.contractAcceptance.count(),1);assert.equal(await db.notification.count({where:{type:'CONTRACT_SIGNED'}}),1);assert.equal((await accountContract(owner,orgId)).acceptance?.signerName,'Test Owner');console.log('PASS required contract, explicit consent, immutable signature, one manager notice');
const outsider={id:randomUUID(),platformRole:'NONE'};await assert.rejects(()=>accountContract(outsider,orgId),{code:'FORBIDDEN'});console.log('PASS cross-account contract access denied');
const branch=await db.branch.create({data:{orgId,name:'Test branch',city:'Test',opensAt:'00:00',closesAt:'23:59'}});
const bay=await db.washBay.create({data:{orgId,branchId:branch.id,name:'Test bay'}});
const scope:any={actor:admin,orgId,branchId:null,role:'PLATFORM_OPERATOR',permissions:['wash.create_session','wash.start_session','wash.manage_services'],isDemo:false};
const wash=await quickWash(scope,{branchId:branch.id,bayId:bay.id,vehicle:{category:'SEDAN'},startNow:true});assert.equal(wash.estimatedMinutes,27);
const service=await db.washService.create({data:{orgId,nameAr:'إضافة',nameEn:'Extra',category:'ALL',price:'25',durationMinutes:90}});
const extra=await addWashExtraService(scope,wash.id,{serviceId:service.id});assert.equal((await db.wash.findUniqueOrThrow({where:{id:wash.id}})).estimatedMinutes,27);await removeWashExtraService(scope,wash.id,extra.id);assert.equal((await db.wash.findUniqueOrThrow({where:{id:wash.id}})).estimatedMinutes,27);console.log('PASS no-service wash uses organization duration; adding/removing 90-minute extra never changes 27-minute estimate');
assert(roles.OWNER.includes('tenant.manage_bays'));assert(roles.OWNER.includes('tenant.manage_services'));const {dispatchPushNotifications}=await import('../src/lib/push-notifications');
const {dispatchEmails}=await import('../src/lib/email-delivery');
const webpush=(await import('web-push')).default;const keys=webpush.generateVAPIDKeys();process.env.VAPID_PUBLIC_KEY=keys.publicKey;process.env.VAPID_PRIVATE_KEY=keys.privateKey;process.env.VAPID_SUBJECT='mailto:test@example.test';
await db.notification.updateMany({data:{readBy:{set:[ownerId]}}});
const late=await db.notification.create({data:{type:'WASH_OVERDUE',orgId,permission:'wash.view_sessions',message:'Test overdue'}});
const sub=await db.pushSubscription.create({data:{userId:ownerId,endpoint:'https://fcm.googleapis.com/test-only',p256dh:'test-only',auth:'test-only',createdAt:new Date(Date.now()-60000)}});
let attempts=0;webpush.sendNotification=async()=>{attempts++;if(attempts===1)throw Object.assign(new Error('temporary'),{statusCode:503});return {} as any;};
await dispatchPushNotifications();assert.equal((await db.pushDelivery.findUniqueOrThrow({where:{subscriptionId_notificationId:{subscriptionId:sub.id,notificationId:late.id}}})).status,'FAILED');
await dispatchPushNotifications();assert.equal((await db.pushDelivery.findUniqueOrThrow({where:{subscriptionId_notificationId:{subscriptionId:sub.id,notificationId:late.id}}})).status,'SENT');await dispatchPushNotifications();assert.equal(attempts,2);console.log('PASS failed push retries, successful push is not duplicated, read notifications skipped');
process.env.RESEND_API_KEY='in-memory-test';const originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response('{"id":"test"}',{status:200});try{await dispatchEmails();}finally{globalThis.fetch=originalFetch;}
const {digest}=await import('../src/lib/crypto');assert.equal(await db.outbox.count({where:{id:digest('notice-email:'+late.id+':'+ownerId)}}),0);console.log('PASS overdue delivered to application only, never queued for email');
console.log('ALL LOCAL SQL/AUTH/NOTIFICATION CHECKS PASSED');
}finally{await db.$disconnect();await pool.end();await memory.close();}
