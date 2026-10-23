import 'dotenv/config';
import {randomUUID,randomBytes} from 'node:crypto';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import type {Scope,Actor} from '../../src/lib/access';
import type {PrismaClient} from '../../src/generated/prisma/client';
let db:PrismaClient;
let onboarding:typeof import('../../src/lib/onboarding');
let access:typeof import('../../src/lib/access');
let operations:typeof import('../../src/lib/operations');
let automation:typeof import('../../src/lib/automation');
let authentication:typeof import('../../src/lib/auth');
let cryptography:typeof import('../../src/lib/crypto');
let customer:typeof import('../../src/lib/customer');
let ownerScope:Scope;let admin:Actor;let orgId:string;let applicationId:string;let activationToken:string;let ownerId:string;let branchId:string;let bayId:string;let serviceId:string;let vehicleId:string;let washId:string;let password:string;
const suffix=randomUUID().slice(0,8);
const ownerEmail=`owner-${suffix}@example.test`;
beforeAll(async()=>{
  const url=process.env.TEST_DATABASE_URL;
  if(!url)throw new Error('TEST_DATABASE_URL is required. No production database fallback.');
  const parsed=new URL(url);
  if(!parsed.pathname.endsWith('_test')&&!(parsed.hostname==='127.0.0.1'&&parsed.port==='51224'))throw new Error('A dedicated test database is required');
  process.env.DATABASE_URL=url;process.env.BETTER_AUTH_SECRET=randomBytes(48).toString('base64url');process.env.BETTER_AUTH_URL='http://localhost:3000';process.env.APP_URL='http://localhost:3000';process.env.ALLOW_SIMULATION='true';
  ({db}=await import('../../src/lib/db'));onboarding=await import('../../src/lib/onboarding');access=await import('../../src/lib/access');operations=await import('../../src/lib/operations');automation=await import('../../src/lib/automation');authentication=await import('../../src/lib/auth');cryptography=await import('../../src/lib/crypto');customer=await import('../../src/lib/customer');
  admin={id:randomUUID(),platformRole:'SUPER_ADMIN'};
  await db.user.create({data:{id:admin.id,name:'Test administrator',email:`admin-${suffix}@example.test`,platformRole:'SUPER_ADMIN',emailVerified:true}});
  password=randomBytes(24).toString('base64url');
});
afterAll(async()=>{await db?.$disconnect();});
describe.sequential('registration → approval → activation → authenticated operations',()=>{
  it('persists a registration and its initial history',async()=>{
    const result=await onboarding.registerApplication({businessName:`Test wash ${suffix}`,ownerName:'Test owner',email:ownerEmail,phone:'+201234567890',city:'Cairo',branchCount:1});applicationId=result.id;expect(result.status).toBe('PENDING');expect(await db.applicationHistory.count({where:{applicationId}})).toBe(1);
  });
  it('rejects an unauthorized application reviewer',async()=>{await expect(onboarding.reviewApplication({id:randomUUID(),platformRole:'NONE'},applicationId,{status:'APPROVED'})).rejects.toMatchObject({code:'FORBIDDEN'});});
  it('provisions an organization once even when approval is repeated',async()=>{
    const first=await onboarding.reviewApplication(admin,applicationId,{status:'APPROVED'});expect(first.orgId).toBeTruthy();orgId=first.orgId!;activationToken=first.invitation!.token;
    const second=await onboarding.reviewApplication(admin,applicationId,{status:'APPROVED'});expect(second.alreadyProcessed).toBe(true);expect(second.orgId).toBe(orgId);expect(await db.invitation.count({where:{orgId,role:'OWNER'}})).toBe(1);
  });
  it('keeps raw activation secrets out of token indexes and outbox plaintext',async()=>{const invite=await db.invitation.findFirstOrThrow({where:{orgId}});const outbox=await db.outbox.findFirstOrThrow({where:{orgId}});expect(invite.tokenHash).toBe(cryptography.digest(activationToken));expect(outbox.encryptedPayload).not.toContain(activationToken);expect(outbox.status).toBe('PROVIDER_UNCONFIGURED');});
  it('activates a new owner with hashed credentials and membership',async()=>{await onboarding.activate({token:activationToken,password});const user=await db.user.findUniqueOrThrow({where:{email:ownerEmail},include:{accounts:true}});ownerId=user.id;expect(user.accounts[0].password).not.toBe(password);ownerScope=await access.tenant({id:ownerId,platformRole:'NONE'},orgId,'tenant.manage_branches');expect(ownerScope.role).toBe('OWNER');});
  it('prevents token replay',async()=>{await expect(onboarding.activate({token:activationToken,password})).rejects.toMatchObject({code:'INVALID_OR_EXPIRED_TOKEN'});});
  it('denies expired activation tokens',async()=>{const secret=cryptography.token();await db.invitation.create({data:{orgId,email:`expired-${suffix}@example.test`,name:'Expired',role:'WORKER',tokenHash:secret.hash,expiresAt:new Date(Date.now()-1000)}});await expect(onboarding.activate({token:secret.raw,password})).rejects.toMatchObject({code:'INVALID_OR_EXPIRED_TOKEN'});});
  it('authenticates the activated owner and creates a real session',async()=>{
    const result=await authentication.auth.api.signInEmail({body:{email:ownerEmail,password},headers:new Headers({origin:'http://localhost:3000'}),asResponse:true});expect(result.status).toBe(200);expect(result.headers.get('set-cookie')).toContain('session_token');const value=await result.json();expect(value.user.id).toBe(ownerId);
  });
  it('blocks public self-signup',async()=>{const response=await authentication.auth.api.signUpEmail({body:{name:'Unauthorized',email:`signup-${suffix}@example.test`,password},headers:new Headers({origin:'http://localhost:3000'}),asResponse:true});expect(response.status).toBeGreaterThanOrEqual(400);});
  it('does not grant platform admins implicit tenant access',async()=>{await expect(access.tenant(admin,orgId,'wash.view_sessions')).rejects.toMatchObject({code:'FORBIDDEN'});});
  it('denies cross-tenant access',async()=>{const another=await db.organization.create({data:{name:'Other tenant',slug:`other-${suffix}`}});await expect(access.tenant(ownerScope.actor,another.id,'wash.view_sessions')).rejects.toMatchObject({code:'FORBIDDEN'});});
  it('creates a service, bay and vehicle inside the owner organization',async()=>{
    branchId=(await db.branch.findFirstOrThrow({where:{orgId}})).id;
    bayId=(await db.washBay.create({data:{orgId,branchId,name:'Bay A'}})).id;
    serviceId=(await db.washService.create({data:{orgId,nameAr:'غسيل كامل',nameEn:'Full wash',price:'125.50',durationMinutes:20}})).id;
    vehicleId=(await operations.createVehicle(ownerScope,{plate:`TEST-${suffix}`,category:'SEDAN'})).id;
  });
  it('allows only one concurrent session to claim the same bay',async()=>{
    const input={branchId,bayId,serviceId,vehicleId};const results=await Promise.allSettled([operations.createWash(ownerScope,input),operations.createWash(ownerScope,input)]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);washId=(results.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<{id:string}>).value.id;expect((await db.washBay.findUniqueOrThrow({where:{id:bayId}})).activeWashId).toBe(washId);
  });
  it('preserves accepted prices after catalog changes',async()=>{await db.washService.update({where:{id:serviceId},data:{price:'200'}});expect((await db.wash.findUniqueOrThrow({where:{id:washId}})).price.toString()).toBe('125.5');});
  it('rejects illegal state changes and stale versions',async()=>{await expect(operations.transitionWash(ownerScope,washId,'COMPLETED',0)).rejects.toMatchObject({code:'INVALID_TRANSITION'});await expect(operations.transitionWash(ownerScope,washId,'WASHING',999)).rejects.toMatchObject({code:'STALE_VERSION'});});
  it('records start, pause, inspection and completion, then frees the bay without collecting cash',async()=>{await operations.transitionWash(ownerScope,washId,'WASHING',0);await operations.transitionWash(ownerScope,washId,'PAUSED',1);await operations.transitionWash(ownerScope,washId,'WASHING',2);await operations.transitionWash(ownerScope,washId,'INSPECTION',3);await operations.transitionWash(ownerScope,washId,'COMPLETED',4);const released=await db.washBay.findUniqueOrThrow({where:{id:bayId}});expect(released.status).toBe('AVAILABLE');expect(released.activeWashId).toBeNull();expect((await db.wash.findUniqueOrThrow({where:{id:washId}})).paymentStatus).not.toBe('PAID');expect(await db.payment.count({where:{washId}})).toBe(0);expect(await db.washHistory.count({where:{washId}})).toBe(6);});
  it('records confirmed cash once and rejects a second receipt',async()=>{const reference=`cash-${suffix}`;const payment=await operations.recordCashPayment(ownerScope,washId,reference);expect((await operations.recordCashPayment(ownerScope,washId,reference)).id).toBe(payment.id);await expect(operations.recordCashPayment(ownerScope,washId,`another-${suffix}`)).rejects.toMatchObject({code:'ALREADY_PAID'});});
  it('does not let workers grant themselves owner privileges',async()=>{const limited={...ownerScope,role:'WORKER',permissions:['wash.view_sessions']};await expect(onboarding.inviteMember(limited,{name:'Intruder',email:`escalation-${suffix}@example.test`,role:'OWNER'})).rejects.toMatchObject({code:'FORBIDDEN'});});
  it('uses tenant-specific vehicle categories and prices without changing other tenants',async()=>{
    const catalog=await import('../../src/lib/catalog-management');
    const custom=await catalog.addVehicleCategory(ownerScope.actor,orgId,{nameAr:'مركبة تجريبية',nameEn:'Custom vehicle'});
    await expect(catalog.addVehicleCategory({id:randomUUID(),platformRole:'NONE'},orgId,{nameAr:'غير مسموح',nameEn:'Denied type'})).rejects.toMatchObject({code:'FORBIDDEN'});
    await expect(operations.createVehicle(ownerScope,{plate:`INVALID-${suffix}`,category:'UNKNOWN_CUSTOM'})).rejects.toMatchObject({code:'INVALID_CATEGORY'});
    const bay=await db.washBay.create({data:{orgId,branchId,name:`Custom price ${suffix}`}});
    await catalog.saveServicePrices(ownerScope.actor,orgId,serviceId,{prices:[{category:custom.code,price:'77.00'},{category:'MOTORCYCLE',price:'30.00'},{category:'BICYCLE',price:'20.00'}]});
    const vehicle=await operations.createVehicle(ownerScope,{plate:`CUSTOM-${suffix}`,category:custom.code});
    const wash=await operations.createWash(ownerScope,{branchId,bayId:bay.id,serviceId,vehicleId:vehicle.id},true);
    expect(wash.price.toString()).toBe('77');
    await operations.transitionWash(ownerScope,wash.id,'COMPLETED',0);
    const other=await db.organization.create({data:{name:'Pricing isolation',slug:`price-other-${suffix}`}});
    await expect(operations.createVehicle({...ownerScope,orgId:other.id},{plate:`OTHER-${suffix}`,category:custom.code})).rejects.toMatchObject({code:'INVALID_CATEGORY'});
  });
  it('rejects cross-tenant service references',async()=>{const another=await db.organization.create({data:{name:'Isolated service org',slug:`service-other-${suffix}`}});const service=await db.washService.create({data:{orgId:another.id,nameAr:'خدمة أخرى',nameEn:'Other service',price:'50',durationMinutes:10}});await expect(operations.createWash(ownerScope,{branchId,serviceId:service.id,vehicleId})).rejects.toMatchObject({code:'NOT_FOUND'});});
  it('suspending an organization immediately denies access',async()=>{await db.organization.update({where:{id:orgId},data:{status:'SUSPENDED'}});await expect(access.tenant(ownerScope.actor,orgId,'wash.view_sessions')).rejects.toMatchObject({code:'FORBIDDEN'});await db.organization.update({where:{id:orgId},data:{status:'ACTIVE'}});});
});
describe.sequential('isolated AI simulation and durable automation',()=>{
  let demoScope:Scope;let cameraId:string;let eventId:string;
  it('prevents simulation in a real organization',async()=>{await expect(automation.simulate(ownerScope,{cameraId:randomUUID(),type:'vehicle.entered_zone',confidence:.9,key:randomUUID()})).rejects.toMatchObject({code:'SIMULATION_DISABLED'});});
  it('creates clearly simulated observations and deduplicates event keys',async()=>{
    const org=await db.organization.create({data:{name:'Demo',slug:`demo-${suffix}`,isDemo:true,memberships:{create:{userId:ownerId,role:'OWNER'}}}});const branch=await db.branch.create({data:{orgId:org.id,name:'Demo branch',city:'Demo'}});const camera=await db.camera.create({data:{orgId:org.id,branchId:branch.id,name:'Demo camera',protocol:'SIMULATED',status:'SIMULATED'}});cameraId=camera.id;demoScope=await access.tenant(ownerScope.actor,org.id,'tenant.manage_automation');
    await db.automationRule.create({data:{orgId:org.id,name:'Entry alert',trigger:'vehicle.entered_zone',action:'CREATE_ALERT',message:'Vehicle entered (simulation)',minConfidence:.8}});
    const input={cameraId,type:'vehicle.entered_zone',confidence:.95,key:randomUUID()};const first=await automation.simulate(demoScope,input);eventId=first.event.id;expect(first.duplicate).toBe(false);const repeated=await automation.simulate(demoScope,input);expect(repeated.duplicate).toBe(true);expect(repeated.event.id).toBe(eventId);expect(await db.observation.count({where:{eventId}})).toBe(1);
  });
  it('runs an automation once, with a persistent execution result',async()=>{await automation.processEvent(eventId);await automation.processEvent(eventId);expect(await db.automationExecution.count({where:{eventId}})).toBe(1);expect(await db.notification.count({where:{orgId:demoScope.orgId}})).toBe(1);expect((await db.automationEvent.findUniqueOrThrow({where:{id:eventId}})).status).toBe('COMPLETED');});
  it('retains original evidence and a separate human review history',async()=>{const observation=await db.observation.findUniqueOrThrow({where:{eventId}});await automation.reviewObservation(demoScope,observation.id,'REJECTED','Incorrect vehicle estimate');const after=await db.observation.findUniqueOrThrow({where:{eventId},include:{reviews:true}});expect(after.rawPayload).toEqual(observation.rawPayload);expect(after.reviews).toHaveLength(1);expect(after.reviewStatus).toBe('REJECTED');});
  it('routes low-confidence events to a skipped result',async()=>{const event=await automation.simulate(demoScope,{cameraId,type:'vehicle.entered_zone',confidence:.2,key:randomUUID()});await automation.processEvent(event.event.id);expect((await db.automationExecution.findFirstOrThrow({where:{eventId:event.event.id}})).status).toBe('SKIPPED');});
  it('retries failures with backoff and ends in a visible dead-letter state',async()=>{
    await db.automationRule.create({data:{orgId:demoScope.orgId,name:'Broken rule for testing',trigger:'camera.disconnected',action:'INVALID_ACTION',message:'Invalid'}});
    const event=await automation.simulate(demoScope,{cameraId,type:'camera.disconnected',confidence:1,key:randomUUID()});
    for(let attempt=1;attempt<=5;attempt++){await db.automationEvent.update({where:{id:event.event.id},data:{nextAttemptAt:new Date(Date.now()-1000)}});await automation.processEvent(event.event.id);const stored=await db.automationEvent.findUniqueOrThrow({where:{id:event.event.id}});expect(stored.attempts).toBe(attempt);expect(stored.status).toBe(attempt===5?'DEAD':'RETRY');}
  });
});
describe.sequential('customer booking, pricing, receipt and feedback',()=>{
  let scope:Scope;let customerVehicleId:string;let bookingId:string;let start:Date;
  it('activates a customer invitation and scopes owned vehicles',async()=>{const invite=await onboarding.inviteMember(ownerScope,{name:'Test customer',email:`customer-${suffix}@example.test`,role:'CUSTOMER'});await onboarding.activate({token:invite.token,password});const user=await db.user.findUniqueOrThrow({where:{email:`customer-${suffix}@example.test`}});scope=await access.tenant({id:user.id,platformRole:'NONE'},orgId,'customers.self');const vehicle=await operations.createVehicle(scope,{plate:`CUSTOMER-${suffix}`,category:'SEDAN',size:'MEDIUM'});customerVehicleId=vehicle.id;expect(vehicle.customerUserId).toBe(user.id);});
  it('snapshots category/size price and tax on the booking',async()=>{
    await db.washService.update({where:{id:serviceId},data:{taxRate:'14'}});await db.servicePricingRule.create({data:{orgId,serviceId,category:'SEDAN',size:'MEDIUM',price:'100'}});
    start=new Date(Date.now()+2*86400000);start.setUTCHours(9,0,0,0);
    const booking=await operations.createWash(scope,{branchId,bayId,serviceId,vehicleId:customerVehicleId,bookedFor:start.toISOString()});bookingId=booking.id;expect(booking.status).toBe('BOOKED');expect(booking.price.toString()).toBe('114');expect(booking.checkedInAt).toBeNull();expect((await db.washBay.findUniqueOrThrow({where:{id:bayId}})).status).toBe('AVAILABLE');
  });
  it('rejects overlapping reservations and a customer vehicle they do not own',async()=>{await expect(operations.createWash(scope,{branchId,bayId,serviceId,vehicleId:customerVehicleId,bookedFor:start.toISOString()})).rejects.toMatchObject({code:'RESERVATION_CONFLICT'});await expect(operations.createWash(scope,{branchId,bayId,serviceId,vehicleId,bookedFor:new Date(start.getTime()+3600000).toISOString()})).rejects.toMatchObject({code:'FORBIDDEN'});});
  it('does not permit customer discounts or manual walk-in creation',async()=>{await expect(operations.createWash(scope,{branchId,bayId,serviceId,vehicleId:customerVehicleId,bookedFor:new Date(start.getTime()+3600000).toISOString(),discount:'10'})).rejects.toMatchObject({code:'FORBIDDEN'});await expect(operations.createWash(scope,{branchId,bayId,serviceId,vehicleId:customerVehicleId})).rejects.toMatchObject({code:'BOOKING_REQUIRED'});});
  it('enforces the configured cancellation window',async()=>{await db.organization.update({where:{id:orgId},data:{cancellationLeadHours:72}});await expect(operations.transitionWash(scope,bookingId,'CANCELLED',0)).rejects.toMatchObject({code:'CANCELLATION_WINDOW_CLOSED'});await db.organization.update({where:{id:orgId},data:{cancellationLeadHours:1}});await operations.transitionWash(scope,bookingId,'CANCELLED',0);expect((await db.wash.findUniqueOrThrow({where:{id:bookingId}})).status).toBe('CANCELLED');});
  it('limits feedback to completed owned sessions',async()=>{const another=await operations.createWash(scope,{branchId,bayId,serviceId,vehicleId:customerVehicleId,bookedFor:start.toISOString()});bookingId=another.id;await expect(customer.feedback(scope,bookingId,{rating:5,comment:'Good'})).rejects.toMatchObject({code:'SESSION_NOT_COMPLETED'});await expect(customer.receipt(scope,bookingId)).rejects.toMatchObject({code:'RECEIPT_UNAVAILABLE'});});
  it('checks in a reservation then permits an actual paid receipt and rating',async()=>{await operations.transitionWash(ownerScope,bookingId,'CHECKED_IN',0);await operations.transitionWash(ownerScope,bookingId,'ASSIGNED',1);await operations.transitionWash(ownerScope,bookingId,'WASHING',2);await operations.transitionWash(ownerScope,bookingId,'INSPECTION',3);await operations.transitionWash(ownerScope,bookingId,'COMPLETED',4);await operations.recordCashPayment(ownerScope,bookingId,`customer-cash-${suffix}`);const receipt=await customer.receipt(scope,bookingId);expect(receipt.total).toBe('114');expect(receipt.tax).toBe('14');expect(receipt.status).toBe('PAID');await customer.feedback(scope,bookingId,{rating:5,comment:'Test feedback'});expect((await db.feedback.findUniqueOrThrow({where:{washId:bookingId}})).rating).toBe(5);});
  it('does not expose another customer receipt',async()=>{await expect(customer.receipt({...scope,actor:{id:randomUUID(),platformRole:'NONE'}},bookingId)).rejects.toMatchObject({code:'FORBIDDEN'});});
});
describe.sequential('password recovery and platform alerts',()=>{
  it('creates an authorized platform alert for a registration',async()=>{expect(await db.notification.count({where:{orgId:null,permission:'platform.review_applications',type:'REGISTRATION_APPLICATION'}})).toBeGreaterThan(0);});
  it('uses encrypted provider-unconfigured outbox and revokes sessions on reset',async()=>{
    await onboarding.requestReset({email:ownerEmail});const item=await db.outbox.findFirstOrThrow({where:{recipient:ownerEmail,kind:'PASSWORD_RESET'},orderBy:{createdAt:'desc'}});const payload=cryptography.unseal(item.encryptedPayload) as {token:string};expect(item.status).toBe('PROVIDER_UNCONFIGURED');expect(item.encryptedPayload).not.toContain(payload.token);
    const verify=await db.verification.findMany();expect(verify.every(v=>!v.identifier.includes(payload.token))).toBe(true);
    const next=randomBytes(24).toString('base64url');await onboarding.resetPassword({token:payload.token,newPassword:next});expect(await db.session.count({where:{userId:ownerId}})).toBe(0);await expect(onboarding.resetPassword({token:payload.token,newPassword:password})).rejects.toBeTruthy();
    const signed=await authentication.auth.api.signInEmail({body:{email:ownerEmail,password:next},headers:new Headers({origin:'http://localhost:3000'}),asResponse:true});expect(signed.status).toBe(200);
  });
  it('keeps unknown-email recovery responses indistinguishable',async()=>{expect(await onboarding.requestReset({email:`missing-${suffix}@example.test`})).toEqual({accepted:true});});
});

describe.sequential('explicit employee and platform delegation',()=>{
  let staffModule:typeof import('../../src/lib/platform-staff');let emptyActor:Actor;let delegated:Actor;let delegatedToken:string;
  it('creates an employee without implicit worker permissions',async()=>{
    const email=`empty-staff-${suffix}@example.test`;const invite=await onboarding.inviteMember(ownerScope,{name:'Empty staff test',email,role:'STAFF',permissions:[]});await onboarding.activate({token:invite.token,password:randomBytes(24).toString('base64url')});const user=await db.user.findUniqueOrThrow({where:{email}});const scope=await access.tenant({id:user.id,platformRole:'NONE'},orgId);expect(scope.permissions).toEqual([]);await expect(access.tenant(scope.actor,orgId,'wash.view_sessions')).rejects.toMatchObject({code:'FORBIDDEN'});await expect(onboarding.inviteMember(scope,{name:'Denied staff',email:`empty-child-${suffix}@example.test`,permissions:[]})).rejects.toMatchObject({code:'FORBIDDEN'});
  });
  it('allows only explicitly delegated employee permissions, including bounded delegation',async()=>{
    const email=`delegated-staff-${suffix}@example.test`;const invite=await onboarding.inviteMember(ownerScope,{name:'Delegated staff test',email,permissions:['tenant.manage_employees','wash.view_sessions']});await onboarding.activate({token:invite.token,password:randomBytes(24).toString('base64url')});const user=await db.user.findUniqueOrThrow({where:{email}});const scope=await access.tenant({id:user.id,platformRole:'NONE'},orgId,'tenant.manage_employees');expect([...scope.permissions].sort()).toEqual(['tenant.manage_employees','wash.view_sessions']);await expect(onboarding.inviteMember(scope,{name:'Too powerful',email:`escalated-child-${suffix}@example.test`,permissions:['finance.manage_payments']})).rejects.toMatchObject({code:'PRIVILEGE_ESCALATION'});const child=await onboarding.inviteMember(scope,{name:'Allowed child',email:`allowed-child-${suffix}@example.test`,permissions:['wash.view_sessions']});expect(child.token).toBeTruthy();
  });
  it('platform staff defaults to no administrative privileges and token cannot be replayed',async()=>{
    staffModule=await import('../../src/lib/platform-staff');const email=`platform-empty-${suffix}@example.test`;const invite=await staffModule.invitePlatformStaff(admin,{name:'Empty platform staff',email});await staffModule.activatePlatformStaff({token:invite.token,password:randomBytes(24).toString('base64url')});const user=await db.user.findUniqueOrThrow({where:{email}});emptyActor={id:user.id,platformRole:user.platformRole,platformPermissions:user.platformPermissions};expect(user.platformPermissions).toEqual([]);expect(()=>access.platform(emptyActor,'platform.manage_tenants')).toThrow();await expect(staffModule.activatePlatformStaff({token:invite.token,password:randomBytes(24).toString('base64url')})).rejects.toMatchObject({code:'INVALID_OR_EXPIRED_TOKEN'});await expect(staffModule.invitePlatformStaff(emptyActor,{name:'Denied',email:`denied-platform-${suffix}@example.test`})).rejects.toMatchObject({code:'FORBIDDEN'});
  });
  it('delegated platform staff cannot grant permissions they do not hold',async()=>{
    const email=`platform-delegated-${suffix}@example.test`;const invite=await staffModule.invitePlatformStaff(admin,{name:'Platform delegator',email,permissions:['platform.manage_users']});await staffModule.activatePlatformStaff({token:invite.token,password:randomBytes(24).toString('base64url')});const user=await db.user.findUniqueOrThrow({where:{email}});delegated={id:user.id,platformRole:user.platformRole,platformPermissions:user.platformPermissions};await expect(staffModule.invitePlatformStaff(delegated,{name:'Too powerful',email:`platform-escalation-${suffix}@example.test`,permissions:['platform.manage_tenants']})).rejects.toMatchObject({code:'PRIVILEGE_ESCALATION'});const invite2=await staffModule.invitePlatformStaff(delegated,{name:'Child platform staff',email:`platform-child-${suffix}@example.test`,permissions:[]});delegatedToken=invite2.token;
  });
  it('rejects self escalation and edits to another administrator hierarchy',async()=>{
    await expect(staffModule.updatePlatformStaff(delegated,delegated.id,{permissions:['platform.manage_users'],active:true})).rejects.toMatchObject({code:'FORBIDDEN'});await expect(staffModule.updatePlatformStaff(delegated,emptyActor.id,{permissions:[],active:true})).rejects.toMatchObject({code:'FORBIDDEN'});
  });
  it('rechecks inviter authority at activation and applies access revocation immediately',async()=>{
    await staffModule.updatePlatformStaff(admin,delegated.id,{permissions:[],active:true});await expect(staffModule.activatePlatformStaff({token:delegatedToken,password:randomBytes(24).toString('base64url')})).rejects.toMatchObject({code:'FORBIDDEN'});const stored=await db.user.findUniqueOrThrow({where:{id:delegated.id}});expect(stored.platformPermissions).toEqual([]);expect(await db.session.count({where:{userId:delegated.id}})).toBe(0);await expect(access.tenant(delegated,orgId)).rejects.toMatchObject({code:'FORBIDDEN'});
  });
});


describe.sequential('private video observations and human reviews',()=>{
 let video:typeof import('../../src/lib/video-analysis');let id:string;
 it('queues a private file without fabricating completed washes',async()=>{
  video=await import('../../src/lib/video-analysis');const bytes=Buffer.alloc(24);bytes.write('ftyp',4);
  const job=await video.queueVideo(ownerScope,{branchId},'test.mp4',bytes);id=job.id;
  expect(job.status).toBe('QUEUED');expect((await video.getVideo(ownerScope,id)).confirmedWashedCount).toBe(0);
 });
 it('denies missing grants and a different tenant or branch',async()=>{
  await expect(video.listVideos({...ownerScope,permissions:[]})).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(video.getVideo({...ownerScope,orgId:randomUUID()},id)).rejects.toMatchObject({code:'NOT_FOUND'});
  await expect(video.getVideo({...ownerScope,branchId:randomUUID()},id)).rejects.toMatchObject({code:'NOT_FOUND'});
  await expect(video.queueVideo(ownerScope,{branchId:randomUUID()},'bad.mp4',Buffer.alloc(24))).rejects.toMatchObject({code:'INVALID_VIDEO_FORMAT'});
 });
 it('preserves raw analysis when an append-only human review changes',async()=>{
  const raw={schemaVersion:1,source:'VIDEO_FILE',tracks:[{trackId:'V001'}],confirmedWashedCount:0};
  await db.videoAnalysis.update({where:{id},data:{status:'COMPLETED',result:raw}});
  await expect(video.reviewVideo(ownerScope,id,{trackId:'V999',category:'UNKNOWN',size:'UNKNOWN',washed:true})).rejects.toMatchObject({code:'NOT_FOUND'});
  await expect(video.reviewVideo(ownerScope,id,{trackId:'V001',category:'UNKNOWN',size:'UNKNOWN',washed:true,serviceId:randomUUID()})).rejects.toMatchObject({code:'NOT_FOUND'});
  await video.reviewVideo(ownerScope,id,{trackId:'V001',category:'SEDAN',size:'MEDIUM',washed:true,note:'Human reference only'});
  expect((await video.getVideo(ownerScope,id)).confirmedWashedCount).toBe(1);
  await video.reviewVideo(ownerScope,id,{trackId:'V001',category:'UNKNOWN',size:'UNKNOWN',washed:null});
  const result=await video.getVideo(ownerScope,id);expect(result.confirmedWashedCount).toBe(0);expect(result.reviews).toHaveLength(2);expect(result.report).toEqual(raw);
 });
 it('serves byte ranges privately and rejects arbitrary paths',async()=>{
  const result=await video.videoFile(ownerScope,id,'source','bytes=0-7');expect(result.status).toBe(206);expect((await result.arrayBuffer()).byteLength).toBe(8);
  await expect(video.videoFile(ownerScope,id,'../source.mp4',null)).rejects.toMatchObject({code:'NOT_FOUND'});
  await expect(video.videoFile(ownerScope,id,'source','bytes=999-')).rejects.toMatchObject({code:'INVALID_RANGE'});
 });
});


describe.sequential('platform bays and private customer tracking',()=>{
 let tracking:typeof import('../../src/lib/customer-tracking');let platformOps:typeof import('../../src/lib/platform-operations');let trackingId:string;let trackingPassword:string;let secret:string;
 it('requires explicit platform bay view and operation grants',async()=>{
  platformOps=await import('../../src/lib/platform-operations');
  await expect(platformOps.platformBays({id:ownerId,platformRole:'NONE'})).rejects.toMatchObject({code:'FORBIDDEN'});
  const viewer={id:admin.id,platformRole:'PLATFORM_ADMIN',platformPermissions:['platform.view_bays']};
  const directory=await platformOps.platformBays(viewer);
  expect(directory.bays.some(b=>b.orgId===orgId)).toBe(true);
  expect(directory.organizations.find(o=>o.id===orgId)?.slug).toBeTruthy();
  await expect(platformOps.platformStart(viewer,{})).rejects.toMatchObject({code:'FORBIDDEN'});
 });
 it('starts a wash atomically in an authorized platform bay',async()=>{
  const bay=await db.washBay.create({data:{orgId,branchId,name:'Platform bay '+suffix}});
  const result=await platformOps.platformStart(admin,{orgId,bayId:bay.id,serviceId,vehicle:{plate:'PLAT-'+suffix,category:'SEDAN',size:'MEDIUM'}});
  const wash=await db.wash.findUniqueOrThrow({where:{id:result.id}});expect(wash.status).toBe('WASHING');expect(wash.startedAt).toBeTruthy();expect((await db.washBay.findUniqueOrThrow({where:{id:bay.id}})).activeWashId).toBe(wash.id);
  await expect(platformOps.platformStart(admin,{orgId,bayId:bay.id,serviceId,vehicle:{plate:'SECOND-'+suffix,category:'SEDAN',size:'MEDIUM'}})).rejects.toMatchObject({code:'BAY_UNAVAILABLE'});
  await platformOps.platformWashTransition(admin,wash.id,{orgId,to:'PAUSED',version:wash.version});
  await platformOps.platformWashTransition(admin,wash.id,{orgId,to:'WASHING',version:wash.version+1});
  await platformOps.platformWashTransition(admin,wash.id,{orgId,to:'COMPLETED',version:wash.version+2});
  expect((await db.washBay.findUniqueOrThrow({where:{id:bay.id}})).activeWashId).toBeNull();
 });
 it('issues a password once and scopes access to one wash',async()=>{
  tracking=await import('../../src/lib/customer-tracking');
  await expect(tracking.issueTracking({...ownerScope,permissions:[]},washId)).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(tracking.issueTracking({...ownerScope,branchId:randomUUID()},washId)).rejects.toMatchObject({code:'FORBIDDEN'});
  const issued=await tracking.issueTracking(ownerScope,washId);trackingId=issued.id;trackingPassword=issued.password;
  expect((await db.customerTracking.findUniqueOrThrow({where:{id:trackingId}})).passwordHash).not.toBe(trackingPassword);
  await expect(tracking.trackingLogin(trackingId,{password:'invalid'})).rejects.toMatchObject({code:'INVALID_TRACKING_ACCESS'});
  secret=await tracking.trackingLogin(trackingId,{password:trackingPassword});const result=await tracking.trackingStatus(trackingId,secret);expect(result).not.toHaveProperty('plate');expect(result).not.toHaveProperty('customerUserId');expect(result).not.toHaveProperty('price');
 });
 it('expires tracking sessions and rejects a secret on a different link',async()=>{
  await expect(tracking.trackingStatus(randomUUID(),secret)).rejects.toMatchObject({code:'INVALID_TRACKING_ACCESS'});
  await db.customerTracking.update({where:{id:trackingId},data:{sessionExpiresAt:new Date(Date.now()-1000)}});
  await expect(tracking.trackingStatus(trackingId,secret)).rejects.toMatchObject({code:'INVALID_TRACKING_ACCESS'});
 });
 it('revokes old tracking immediately when new access is issued',async()=>{
  await tracking.issueTracking(ownerScope,washId);await expect(tracking.trackingStatus(trackingId,secret)).rejects.toMatchObject({code:'INVALID_TRACKING_ACCESS'});await expect(tracking.trackingLogin(trackingId,{password:trackingPassword})).rejects.toMatchObject({code:'INVALID_TRACKING_ACCESS'});
 });
});

describe.sequential('simplified operations, camera IP, customers and daily statistics',()=>{
 let bays:typeof import('../../src/lib/bay-management');let quick:typeof import('../../src/lib/quick-wash');let clients:typeof import('../../src/lib/wash-customers');let stats:typeof import('../../src/lib/statistics');let currentBay:string;let quickId:string;let secondBranch:string;
 it('creates a bay only in an authorized active branch',async()=>{
  bays=await import('../../src/lib/bay-management');quick=await import('../../src/lib/quick-wash');clients=await import('../../src/lib/wash-customers');stats=await import('../../src/lib/statistics');
  currentBay=(await bays.createBay(ownerScope,{branchId,name:'Quick bay '+suffix})).id;
  await expect(bays.createBay({...ownerScope,permissions:[]},{branchId,name:'Denied bay'})).rejects.toMatchObject({code:'FORBIDDEN'});
  secondBranch=(await db.branch.create({data:{orgId,name:'Other branch',city:'Cairo'}})).id;
  await expect(bays.createBay({...ownerScope,branchId:secondBranch},{branchId,name:'Wrong branch'})).rejects.toMatchObject({code:'FORBIDDEN'});
 });
 it('stores only a validated own-bay IP and rejects tenant/branch substitution',async()=>{
  const first=await bays.saveCameraIp(ownerScope,{bayId:currentBay,ipAddress:'192.168.1.25'});const updated=await bays.saveCameraIp(ownerScope,{bayId:currentBay,ipAddress:'192.168.1.26'});expect(updated.id).toBe(first.id);
  expect(await db.camera.findUniqueOrThrow({where:{id:first.id}})).toMatchObject({status:'UNCONFIGURED',processingEnabled:false,ipAddress:'192.168.1.26'});
  await expect(bays.saveCameraIp({...ownerScope,orgId:randomUUID()},{bayId:currentBay,ipAddress:'192.168.1.1'})).rejects.toMatchObject({code:'NOT_FOUND'});
  await expect(bays.saveCameraIp({...ownerScope,branchId:secondBranch},{bayId:currentBay,ipAddress:'192.168.1.1'})).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(bays.saveCameraIp(ownerScope,{bayId:currentBay,ipAddress:'https://camera.example'})).rejects.toBeTruthy();
 });
 it('starts directly, blocks conflicting starts and prevents changing occupied bay status',async()=>{
  const result=await quick.quickWash(ownerScope,{branchId,bayId:currentBay,serviceId,vehicle:{plate:'QUICK-'+suffix,category:'SEDAN',size:'MEDIUM'},startNow:true});quickId=result.id;
  expect(result.status).toBe('WASHING');expect(result.startedAt).toBeTruthy();
  await expect(quick.quickWash(ownerScope,{branchId,bayId:currentBay,serviceId,vehicle:{plate:'QUICK-'+suffix,category:'SEDAN',size:'MEDIUM'},startNow:true})).rejects.toMatchObject({code:'BAY_UNAVAILABLE'});
  await expect(bays.updateBay(ownerScope,currentBay,{status:'MAINTENANCE'})).rejects.toMatchObject({code:'BAY_OCCUPIED'});
  await bays.updateBay(ownerScope,currentBay,{name:'Renamed occupied bay'});
 });
 it('finishes directly once, releases the bay and records actual history without invented inspection',async()=>{
  await operations.transitionWash(ownerScope,quickId,'COMPLETED',0);
  expect(await db.washBay.findUniqueOrThrow({where:{id:currentBay}})).toMatchObject({status:'AVAILABLE',activeWashId:null});
  expect((await db.washHistory.findMany({where:{washId:quickId}})).some(h=>h.toStatus==='INSPECTION')).toBe(false);
  await expect(operations.transitionWash(ownerScope,quickId,'COMPLETED',0)).rejects.toMatchObject({code:'INVALID_TRANSITION'});expect(await db.washHistory.count({where:{washId:quickId,toStatus:'COMPLETED'}})).toBe(1);
  await bays.updateBay(ownerScope,currentBay,{status:'MAINTENANCE'});await bays.updateBay(ownerScope,currentBay,{status:'AVAILABLE'});
 });
 it('creates a contact without a new password and keeps directories inside tenant/branch',async()=>{
  const result=await clients.quickCustomer(ownerScope,{name:'Quick test customer',phone:'+20 101 234 5678',bayId:currentBay,serviceId,category:'SEDAN'});quickId=result.washId;
  expect(result).not.toHaveProperty('password');const directory=await clients.listWashCustomers(ownerScope);const profile=directory.find(c=>c.id===result.customerId);expect(profile?.phone).toBe('+201012345678');expect(profile?.washes.some(w=>w.id===quickId)).toBe(true);
  expect(await clients.listWashCustomers({...ownerScope,orgId:randomUUID()})).toEqual([]);expect(await clients.listWashCustomers({...ownerScope,branchId:secondBranch})).toEqual([]);
  await expect(clients.listWashCustomers({...ownerScope,permissions:[]})).rejects.toMatchObject({code:'FORBIDDEN'});
  const reissued=await clients.quickCustomer({...ownerScope,permissions:['tenant.manage_customers']},{name:'Quick test customer',phone:'+201012345678',bayId:currentBay,category:'SEDAN'});expect(reissued.customerId).toBe(result.customerId);
  await expect(clients.quickCustomer(ownerScope,{name:'Different customer',phone:'+201099999999',bayId:currentBay,category:'SEDAN'})).rejects.toMatchObject({code:'CUSTOMER_ALREADY_LINKED'});
 });
 it('publishes only the selected bay and safe wash details on the permanent link',async()=>{
  const publicTracking=await import('../../src/lib/public-bay-tracking');
  const org=await db.organization.findUniqueOrThrow({where:{id:orgId}});
  const directory=await publicTracking.publicWashBays(org.slug);
  expect(directory.bays.some(b=>b.id===currentBay)).toBe(true);
  expect(directory.bays[0]).not.toHaveProperty('status');
  const selected=await publicTracking.publicBayStatus(org.slug,currentBay);
  expect(selected.bay).toBe((await db.washBay.findUniqueOrThrow({where:{id:currentBay}})).name);
  expect(selected).not.toHaveProperty('customerName');expect(selected).not.toHaveProperty('phone');expect(selected).not.toHaveProperty('price');
  expect(selected.wash).not.toHaveProperty('plate');
  await expect(publicTracking.publicBayStatus(org.slug,randomUUID())).rejects.toMatchObject({code:'NOT_FOUND'});
  await expect(publicTracking.publicBayStatus('other-org',currentBay)).rejects.toMatchObject({code:'NOT_FOUND'});
 });
 it('claims a chosen bay on one-click start for a waiting session',async()=>{
  const free=await bays.createBay(ownerScope,{branchId,name:'Wait start '+suffix});const wash=await operations.createWash(ownerScope,{branchId,serviceId,vehicleId});expect(wash.bayId).toBeNull();
  await operations.transitionWash(ownerScope,wash.id,'WASHING',0,free.id);expect((await db.washBay.findUniqueOrThrow({where:{id:free.id}})).activeWashId).toBe(wash.id);
  await operations.transitionWash(ownerScope,wash.id,'COMPLETED',1);
 });
 it('reports real day boundaries with no finance leakage and no snapshot cap',async()=>{
  const date='2024-01-15';await db.wash.update({where:{id:quickId},data:{createdAt:new Date('2024-01-15T12:00:00Z')}});
  const limited={...ownerScope,permissions:['reports.view']};const day=await stats.dailyStatistics(limited,date);expect(day.sessions).toBe(1);expect(day).not.toHaveProperty('revenue');expect((await stats.dailyStatistics(limited,'2024-01-14')).sessions).toBe(0);
  expect((await stats.dailyStatistics({...limited,branchId:secondBranch},date)).sessions).toBe(0);
  await expect(stats.dailyStatistics({...ownerScope,permissions:[]},date)).rejects.toMatchObject({code:'FORBIDDEN'});
  const base=await db.wash.findUniqueOrThrow({where:{id:quickId}});const copies=Array.from({length:205},()=>({...base,id:randomUUID(),bayId:null,customerProfileId:null,createdAt:new Date('2024-01-15T12:00:00Z')}));await db.wash.createMany({data:copies});expect((await stats.dailyStatistics(limited,date)).sessions).toBe(206);
 });
 it('shows empty organizations and separates platform start/finish/manage permissions',async()=>{
  const platformOps=await import('../../src/lib/platform-operations');const empty=await db.organization.create({data:{name:'Empty wash '+suffix,slug:'empty-wash-'+suffix}});const viewer={id:admin.id,platformRole:'PLATFORM_ADMIN',platformPermissions:['platform.view_bays']} as Actor;
  const list=await platformOps.platformBays(viewer);expect(list.organizations.some(o=>o.id===empty.id)).toBe(true);expect(list.bays.filter(b=>b.orgId===orgId).flatMap(b=>b.cameras).every(c=>!('ipAddress'in c))).toBe(true);
  await expect(bays.platformBayScope(viewer,orgId,'platform.manage_bays')).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(platformOps.platformWashTransition({...viewer,platformPermissions:['platform.operate_washes']},quickId,{orgId,to:'COMPLETED',version:0})).rejects.toMatchObject({code:'FORBIDDEN'});
 });
});

describe.sequential('camera analysis configuration and forms without vehicle size',()=>{
 it('supports a new wash with omitted size and preserves a known vehicle internally',async()=>{
  const quick=await import('../../src/lib/quick-wash');const bay=await db.washBay.create({data:{orgId,branchId,name:'No size bay '+suffix}});
  const vehicle=await operations.createVehicle(ownerScope,{plate:'NO-SIZE-'+suffix,category:'SUV',size:'LARGE'});
  const result=await quick.quickWash(ownerScope,{branchId,bayId:bay.id,serviceId,vehicle:{plate:vehicle.plate,category:'SUV'},startNow:true});expect(result.vehicleId).toBe(vehicle.id);expect(result.status).toBe('WASHING');await operations.transitionWash(ownerScope,result.id,'COMPLETED',0);const clients=await import('../../src/lib/wash-customers');const contact=await clients.quickCustomer(ownerScope,{name:'No size contact',phone:'+201011122233',bayId:bay.id,serviceId,plate:vehicle.plate,category:'SUV'});expect(contact.washId).toBeTruthy();
 });
 it('validates image orientation, sampling and same-branch bay/camera configuration',async()=>{
  const video=await import('../../src/lib/video-analysis');expect(video.videoConfig.parse({branchId,rotation:270,sampleFps:.5}).rotation).toBe(270);expect(video.videoConfig.safeParse({branchId,rotation:45}).success).toBe(false);expect(video.videoConfig.safeParse({branchId,zone:{x:.9,y:0,width:.5,height:1}}).success).toBe(false);
  const bytes=Buffer.alloc(24);bytes.write('ftyp',4);await expect(video.queueVideo(ownerScope,{branchId,bayId:randomUUID()},'bad-bay.mp4',bytes)).rejects.toMatchObject({code:'NOT_FOUND'});
 });
});

describe.sequential('reusable camera calibration and deduplicated gate automation',()=>{
 let cameraId:string;
 it('versions camera calibration and denies tenant/branch/grant substitution',async()=>{
  const bays=await import('../../src/lib/bay-management');cameraId=(await db.camera.create({data:{orgId,branchId,bayId,name:'Gate camera',protocol:'RTSP'}})).id;const raw={rotation:270,gate:{xMin:.39,xMax:.77,entryY:.4,exitY:.28}};
  expect((await bays.saveCameraCalibration(ownerScope,cameraId,raw)).version).toBe(1);expect((await bays.saveCameraCalibration(ownerScope,cameraId,raw)).version).toBe(2);
  await expect(bays.saveCameraCalibration({...ownerScope,permissions:[]},cameraId,raw)).rejects.toMatchObject({code:'FORBIDDEN'});await expect(bays.saveCameraCalibration({...ownerScope,orgId:randomUUID()},cameraId,raw)).rejects.toMatchObject({code:'NOT_FOUND'});await expect(bays.saveCameraCalibration({...ownerScope,branchId:randomUUID()},cameraId,raw)).rejects.toMatchObject({code:'FORBIDDEN'});
 });
 it('uses saved camera calibration on later replay automatically',async()=>{
  const video=await import('../../src/lib/video-analysis');const bytes=Buffer.alloc(24);bytes.write('ftyp',4);const queued=await video.queueVideo(ownerScope,{branchId,cameraId},'gate-test.mp4',bytes);const job=await db.videoAnalysis.findUniqueOrThrow({where:{id:queued.id}});expect(job.config).toMatchObject({rotation:270,bayId,calibrationVersion:2,gate:{entryY:.4,exitY:.28}});
 });
 it('records normalized entry/exit once on retry and cannot treat replay as a real wash',async()=>{
  const {emitCameraGateEvents}=await import('../../src/lib/camera-events');const {transaction}=await import('../../src/lib/transactions');const job={id:randomUUID(),orgId,branchId,cameraId,sourceSha256:randomBytes(32).toString('hex'),config:{bayId}};const report={video:{durationSeconds:966},automation:{engine:'BAY_GATE_V1',events:[{type:'vehicle.entered_bay',videoSeconds:5.517,confirmedAtSeconds:7.033,confidence:.5},{type:'vehicle.exited_bay',videoSeconds:963.05,confirmedAtSeconds:963.55,confidence:.6}]}} as unknown as import('../../src/lib/video-analysis').VideoReport;
  const count=await db.wash.count({where:{orgId}});const first=await transaction(tx=>emitCameraGateEvents(tx,job,report));const repeated=await transaction(tx=>emitCameraGateEvents(tx,{...job,id:randomUUID()},report));expect(repeated).toEqual(first);expect(first).toHaveLength(2);
  for(const id of first)await automation.processEvent(id);expect(await db.wash.count({where:{orgId}})).toBe(count);expect((await db.automationEvent.findUniqueOrThrow({where:{id:first[0]}})).payload).toMatchObject({replay:true,eventMeaning:'vehicle.entered_bay',bayId});
 });
});

describe.sequential('camera visits persist entry and exit independently from financial washes',()=>{
 let job:{id:string;orgId:string;branchId:string;cameraId:null;sourceSha256:string;config:{bayId:string}};let visitId:string;
 const makeReport=(events:unknown[])=>({video:{durationSeconds:100},tracks:[],automation:{engine:'BAY_GATE_V1',events}} as unknown as import('../../src/lib/video-analysis').VideoReport);
 it('opens a scoped visit on entry and keeps it open through missing detections',async()=>{
  const {emitCameraGateEvents}=await import('../../src/lib/camera-events');const {transaction}=await import('../../src/lib/transactions');job={id:randomUUID(),orgId,branchId,cameraId:null,sourceSha256:randomBytes(32).toString('hex'),config:{bayId}};
  await transaction(tx=>emitCameraGateEvents(tx,job,makeReport([{type:'vehicle.entered_bay',videoSeconds:5,confirmedAtSeconds:6,confidence:.7}])));
  const row=await db.cameraVisit.findFirstOrThrow({where:{orgId,analysisId:job.id}});visitId=row.id;expect(row).toMatchObject({status:'IN_BAY',enteredSeconds:5,exitedSeconds:null,category:'UNKNOWN',washStatus:'UNCONFIRMED',replay:true,enteredAt:null});
  await transaction(tx=>emitCameraGateEvents(tx,job,makeReport([])));expect((await db.cameraVisit.findUniqueOrThrow({where:{id:visitId}})).status).toBe('IN_BAY');
 });
 it('closes the same record on exit once without inventing a wash or payment',async()=>{
  const {emitCameraGateEvents}=await import('../../src/lib/camera-events');const {transaction}=await import('../../src/lib/transactions');const count=await db.wash.count({where:{orgId}});const report=makeReport([{type:'vehicle.entered_bay',videoSeconds:5,confirmedAtSeconds:6,confidence:.7},{type:'vehicle.exited_bay',videoSeconds:95,confirmedAtSeconds:96,confidence:.8}]);
  await transaction(tx=>emitCameraGateEvents(tx,job,report));await transaction(tx=>emitCameraGateEvents(tx,{...job,id:randomUUID()},report));expect(await db.cameraVisit.count({where:{orgId,streamKey:(await db.cameraVisit.findUniqueOrThrow({where:{id:visitId}})).streamKey}})).toBe(1);expect(await db.cameraVisit.findUniqueOrThrow({where:{id:visitId}})).toMatchObject({status:'EXITED',exitedSeconds:95,occupancySeconds:90,washStatus:'UNCONFIRMED'});expect(await db.wash.count({where:{orgId}})).toBe(count);
 });
 it('isolates org/branch/grants and labels staff confirmation explicitly',async()=>{
  const visits=await import('../../src/lib/camera-visits');await expect(visits.listCameraVisits({...ownerScope,permissions:[]})).rejects.toMatchObject({code:'FORBIDDEN'});expect(await visits.listCameraVisits({...ownerScope,branchId:randomUUID()})).toEqual([]);expect(await visits.listCameraVisits({...ownerScope,orgId:randomUUID()})).toEqual([]);
  await expect(visits.reviewCameraVisit({...ownerScope,permissions:['wash.view_sessions']},visitId,{category:'SUV',washed:true})).rejects.toMatchObject({code:'FORBIDDEN'});await expect(visits.reviewCameraVisit({...ownerScope,branchId:randomUUID()},visitId,{category:'SUV',washed:true})).rejects.toMatchObject({code:'NOT_FOUND'});
  await visits.reviewCameraVisit(ownerScope,visitId,{category:'FULL_SIZE_SUV',washed:true});expect(await db.cameraVisit.findUniqueOrThrow({where:{id:visitId}})).toMatchObject({category:'FULL_SIZE_SUV',categorySource:'HUMAN_REVIEW',washStatus:'CONFIRMED',reviewedBy:ownerId});
 });
 it('rejects a bay assigned to another organization or camera',async()=>{
  const {emitCameraGateEvents}=await import('../../src/lib/camera-events');const {transaction}=await import('../../src/lib/transactions');await expect(transaction(tx=>emitCameraGateEvents(tx,{...job,config:{bayId:randomUUID()}},makeReport([{type:'vehicle.entered_bay',videoSeconds:5,confirmedAtSeconds:6,confidence:.7}])))).rejects.toMatchObject({code:'INVALID_CAMERA_BAY'});
 });
});

describe.sequential('three-category AI evidence and human correction',()=>{
 it('persists a visual 4x4 estimate with provenance without overriding a staff correction',async()=>{
  const {emitCameraGateEvents}=await import('../../src/lib/camera-events');const {transaction}=await import('../../src/lib/transactions');const {reviewCameraVisit}=await import('../../src/lib/camera-visits');const job={id:randomUUID(),orgId,branchId,cameraId:null,sourceSha256:randomBytes(32).toString('hex'),config:{bayId}};
  const report={video:{durationSeconds:100},tracks:[],automation:{engine:'BAY_GATE_V1',cycles:[{entrySeconds:5,classification:{category:'FULL_SIZE_SUV',source:'AI_VISUAL',similarity:.6,margin:.04,requiresReview:true,meaning:'BODY_SHAPE_NOT_DRIVETRAIN'}}],events:[{type:'vehicle.entered_bay',videoSeconds:5,confirmedAtSeconds:6,confidence:.7},{type:'vehicle.exited_bay',videoSeconds:95,confirmedAtSeconds:96,confidence:.8}]}} as unknown as import('../../src/lib/video-analysis').VideoReport;
  await transaction(tx=>emitCameraGateEvents(tx,job,report));let row=await db.cameraVisit.findFirstOrThrow({where:{orgId,analysisId:job.id}});expect(row).toMatchObject({category:'FULL_SIZE_SUV',categorySource:'AI_VISUAL',washStatus:'UNCONFIRMED'});expect(row.categoryEvidence).toMatchObject({similarity:.6,requiresReview:true});
  await reviewCameraVisit(ownerScope,row.id,{category:'SUV',washed:true});await transaction(tx=>emitCameraGateEvents(tx,job,report));row=await db.cameraVisit.findUniqueOrThrow({where:{id:row.id}});expect(row).toMatchObject({category:'SUV',categorySource:'HUMAN_REVIEW',washStatus:'CONFIRMED'});
 });
 it('accepts built-in vehicle categories and validates custom category codes',async()=>{
  const {vehicleInput}=await import('../../src/lib/validation');for(const category of ['SEDAN','SUV','FULL_SIZE_SUV','MOTORCYCLE','BICYCLE','CUSTOM_ABC123'])expect(vehicleInput.safeParse({plate:'TYPE-TEST',category}).success).toBe(true);expect(vehicleInput.safeParse({plate:'TYPE-TEST',category:'bad category'}).success).toBe(false);
 });
});

describe.sequential('platform creation and vehicle-type reporting',()=>{
 it('creates a wash and owner invitation only for an authorized platform manager',async()=>{
  const input={businessName:`Direct wash ${suffix}`,ownerName:'New owner',email:`direct-${suffix}@example.test`,phone:'+201234567890',city:'Cairo',branchCount:1};
  await expect(onboarding.createOrganizationWithOwner({id:randomUUID(),platformRole:'NONE'},input)).rejects.toMatchObject({code:'FORBIDDEN'});
  const result=await onboarding.createOrganizationWithOwner(admin,input);
  expect(result.invitation.token.length).toBeGreaterThan(20);
  expect(await db.branch.count({where:{orgId:result.id}})).toBe(1);
  expect(await db.invitation.count({where:{orgId:result.id,role:'OWNER'}})).toBe(1);
 });
 it('reports completed washes by organization and vehicle category only to report viewers',async()=>{
  const {platformWashReport}=await import('../../src/lib/platform-reports');
  await expect(platformWashReport({id:randomUUID(),platformRole:'NONE'},'all')).rejects.toMatchObject({code:'FORBIDDEN'});
  const report=await platformWashReport(admin,'all');
  const org=report.organizations.find(item=>item.id===orgId);
  expect(org).toBeDefined();
  expect(org!.total).toBe(org!.categories.reduce((sum,item)=>sum+item.count,0));
  expect(org!.categories.every(item=>item.count>0)).toBe(true);
  expect(org!.bays.every(bay=>bay.total>=0&&bay.today<=bay.week&&bay.week<=bay.total)).toBe(true);
  expect(org!.averageMinutes).toBeGreaterThanOrEqual(0);
  expect(org!.log.length).toBeLessThanOrEqual(20);
  const own=await platformWashReport(admin,'all');
  expect(own.organizations.some(item=>item.id===orgId)).toBe(true);
 });
 it('scopes wash-owner reports to their organization and branch',async()=>{
  const {tenantWashReport}=await import('../../src/lib/platform-reports');
  await expect(tenantWashReport({...ownerScope,permissions:[]},'all')).rejects.toMatchObject({code:'FORBIDDEN'});
  const own=await tenantWashReport(ownerScope,'all');
  expect(own.organizations).toHaveLength(1);
  expect(own.organizations[0].id).toBe(orgId);
  const otherBranch=await tenantWashReport({...ownerScope,branchId:randomUUID()},'all');
  expect(otherBranch.organizations[0].total).toBe(0);
 });
 it('publishes only the notice of the selected wash and protects editing',async()=>{
  const {savePublicNotice}=await import('../../src/lib/public-notice');
  const {publicWashBays}=await import('../../src/lib/public-bay-tracking');
  await expect(savePublicNotice({id:randomUUID(),platformRole:'NONE'},orgId,{message:'Denied'},true)).rejects.toMatchObject({code:'FORBIDDEN'});
  await savePublicNotice(admin,orgId,{message:'Current wait: 15 minutes'},true);
  const org=await db.organization.findUniqueOrThrow({where:{id:orgId},select:{slug:true}});
  expect((await publicWashBays(org.slug)).notice).toBe('Current wait: 15 minutes');
  await savePublicNotice(admin,orgId,{message:''},true);
 });
});
