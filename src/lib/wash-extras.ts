import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {Prisma} from '@/generated/prisma/client';
import {assert} from './errors';
import {branchScope,type Scope} from './access';
import {transaction,audit} from './transactions';

const active=['ASSIGNED','WASHING','PAUSED','INSPECTION'];
export async function adjustWashMinutes(scope:Scope,id:string,raw:unknown){
 const {deltaSeconds}=z.object({deltaSeconds:z.number().int().refine(value=>value!==0&&Math.abs(value)<=7200&&value%30===0)}).parse(raw);
 assert(scope.permissions.includes('wash.start_session'),'FORBIDDEN',403);
 return transaction(async tx=>{
  const wash=await tx.wash.findFirst({where:{id,orgId:scope.orgId}});assert(wash,'NOT_FOUND',404);branchScope(scope,wash.branchId);
  assert(active.includes(wash.status),'WASH_NOT_ACTIVE',409);
  const next=wash.estimatedMinutes*60+wash.timeAdjustmentSeconds+deltaSeconds;assert(next>=30&&next<=86400,'INVALID_DURATION',422);
  const updated=await tx.wash.update({where:{id:wash.id},data:{timeAdjustmentSeconds:{increment:deltaSeconds},version:{increment:1}}});
  await audit(tx,scope.actor.id,'wash.time_adjusted','wash',id,scope.orgId,{deltaSeconds,totalSeconds:next});
  return {estimatedMinutes:updated.estimatedMinutes,timeAdjustmentSeconds:updated.timeAdjustmentSeconds,version:updated.version};
 });
}
export async function addWashExtraService(scope:Scope,id:string,raw:unknown){
 assert(scope.permissions.includes('tenant.manage_services')||scope.permissions.includes('wash.manage_services'),'FORBIDDEN',403);
 const {serviceId}=z.object({serviceId:z.uuid()}).parse(raw);
 return transaction(async tx=>{
  const wash=await tx.wash.findFirst({where:{id,orgId:scope.orgId},include:{vehicle:true}});assert(wash,'NOT_FOUND',404);branchScope(scope,wash.branchId);
  assert(['WASHING','PAUSED','INSPECTION'].includes(wash.status),'WASH_NOT_ACTIVE',409);
  assert(wash.paymentStatus==='UNPAID','PAYMENT_ALREADY_RECORDED',409);
  const service=await tx.washService.findFirst({where:{id:serviceId,orgId:scope.orgId,active:true}});assert(service,'NOT_FOUND',404);
  assert(service.category==='ALL'||service.category===wash.vehicle.category,'SERVICE_CATEGORY_MISMATCH',422);
  const rules=await tx.servicePricingRule.findMany({where:{orgId:scope.orgId,serviceId,category:{in:[wash.vehicle.category,'ALL']},size:{in:[wash.vehicle.size,'ALL']}}});
  rules.sort((a,b)=>(Number(b.category!=='ALL')*2+Number(b.size!=='ALL'))-(Number(a.category!=='ALL')*2+Number(a.size!=='ALL')));
  const base=rules[0]?.price??service.price;
  const serviceMinutes=rules[0]?.durationMinutes??service.durationMinutes;

  const price=base;
  assert((wash.estimatedMinutes+serviceMinutes)*60+wash.timeAdjustmentSeconds<=86400,'INVALID_DURATION',422);
  const extra=await tx.washExtraService.create({data:{id:randomUUID(),orgId:scope.orgId,washId:id,serviceId,nameAr:service.nameAr,nameEn:service.nameEn,price,durationMinutes:serviceMinutes,addedById:scope.actor.id}});
  const nextSubtotal=wash.subtotal.plus(base);

  const nextTaxable=nextSubtotal.minus(wash.discount);
  const nextTax=new Prisma.Decimal(0);
  await tx.wash.update({where:{id},data:{subtotal:nextSubtotal,taxAmount:nextTax,price:nextTaxable.plus(nextTax),estimatedMinutes:{increment:serviceMinutes},version:{increment:1}}});
  await audit(tx,scope.actor.id,'wash.extra_service_added','wash',id,scope.orgId,{serviceId,extraId:extra.id,price:String(price)});
  return {id:extra.id,nameAr:extra.nameAr,nameEn:extra.nameEn,price:String(extra.price),durationMinutes:extra.durationMinutes};
 });
}
export async function removeWashExtraService(scope:Scope,id:string,extraId:string){
 assert(scope.permissions.includes('tenant.manage_services')||scope.permissions.includes('wash.manage_services'),'FORBIDDEN',403);
 return transaction(async tx=>{
  const wash=await tx.wash.findFirst({where:{id,orgId:scope.orgId}});assert(wash,'NOT_FOUND',404);branchScope(scope,wash.branchId);
  assert(['WASHING','PAUSED','INSPECTION'].includes(wash.status),'WASH_NOT_ACTIVE',409);
  assert(wash.paymentStatus==='UNPAID','PAYMENT_ALREADY_RECORDED',409);
  const extra=await tx.washExtraService.findFirst({where:{id:extraId,washId:id,orgId:scope.orgId}});assert(extra,'NOT_FOUND',404);
  const service=await tx.washService.findFirst({where:{id:extra.serviceId,orgId:scope.orgId}});assert(service,'NOT_FOUND',404);
  const base=extra.price;
  const nextSubtotal=wash.subtotal.minus(base);
  const nextDiscount=Prisma.Decimal.min(wash.discount,nextSubtotal);

  const taxable=nextSubtotal.minus(nextDiscount);
  const nextTax=new Prisma.Decimal(0);
  await tx.washExtraService.delete({where:{id:extraId}});
  await tx.wash.update({where:{id},data:{subtotal:nextSubtotal,discount:nextDiscount,taxAmount:nextTax,price:taxable.plus(nextTax),estimatedMinutes:{decrement:extra.durationMinutes},version:{increment:1}}});
  await audit(tx,scope.actor.id,'wash.extra_service_removed','wash',id,scope.orgId,{extraId});
  return {removed:true};
 });
}
export async function sendWashComment(scope:Scope,id:string,raw:unknown){
 assert(scope.role!=='OWNER'&&scope.permissions.includes('wash.view_sessions'),'FORBIDDEN',403);
 const {comment}=z.object({comment:z.string().trim().min(2).max(500)}).parse(raw);
 return transaction(async tx=>{
  const wash=await tx.wash.findFirst({where:{id,orgId:scope.orgId},include:{org:{select:{name:true}},bay:{select:{name:true}}}});assert(wash,'NOT_FOUND',404);branchScope(scope,wash.branchId);
  const message=`${wash.org.name} — ${wash.bay?.name??'بدون حوض'}: ${comment}`;
  const notification=await tx.notification.create({data:{orgId:null,permission:'platform.manage_tenants',type:'WASH_COMMENT',message}});
  await tx.notification.create({data:{orgId:scope.orgId,permission:'tenant.manage_profile',type:'WASH_COMMENT',message}});
  await audit(tx,scope.actor.id,'wash.comment_sent','wash',id,scope.orgId,{notificationId:notification.id});
  return {id:notification.id};
 });
}
export async function setWashDiscount(scope:Scope,id:string,raw:unknown){
 assert(scope.permissions.includes('finance.manage_payments'),'FORBIDDEN',403);
 const {discount}=z.object({discount:z.string().regex(/^\d{1,9}(\.\d{1,2})?$/)}).parse(raw);
 return transaction(async tx=>{
  const wash=await tx.wash.findFirst({where:{id,orgId:scope.orgId}});assert(wash,'NOT_FOUND',404);branchScope(scope,wash.branchId);
  assert(active.includes(wash.status),'WASH_NOT_ACTIVE',409);
  assert(wash.paymentStatus==='UNPAID','PAYMENT_ALREADY_RECORDED',409);
  const amount=new Prisma.Decimal(discount);
  assert(amount.lte(wash.subtotal),'DISCOUNT_EXCEEDS_TOTAL',422);

  const taxable=wash.subtotal.minus(amount);
  const tax=new Prisma.Decimal(0);
  const updated=await tx.wash.update({where:{id},data:{discount:amount,taxAmount:tax,price:taxable.plus(tax),version:{increment:1}}});
  await audit(tx,scope.actor.id,'wash.discount_changed','wash',id,scope.orgId,{discount:String(amount)});
  return {discount:String(updated.discount),price:String(updated.price),version:updated.version};
 });
}
export async function sendOwnerMessage(scope:Scope,raw:unknown){
 assert(scope.role==='OWNER','FORBIDDEN',403);
 const {message}=z.object({message:z.string().trim().min(2).max(1000)}).parse(raw);
 return transaction(async tx=>{
  const [org,user]=await Promise.all([tx.organization.findUnique({where:{id:scope.orgId},select:{name:true}}),tx.user.findUnique({where:{id:scope.actor.id},select:{name:true}})]);
  assert(org&&user,'NOT_FOUND',404);
  const notice=await tx.notification.create({data:{orgId:null,permission:'platform.manage_tenants',type:'OWNER_MESSAGE',message:`${org.name} — ${user.name}: ${message}`}});
  await audit(tx,scope.actor.id,'owner.message_sent','organization',scope.orgId,scope.orgId,{notificationId:notice.id});
  return {id:notice.id};
 });
}
