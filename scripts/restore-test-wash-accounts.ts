import 'dotenv/config';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {hashPassword} from 'better-auth/crypto';
import {db} from '../src/lib/db';

const credentials=await readFile(resolve('..','opsvision-new-wash-385f5e00-accounts.txt'),'utf8');
const ownerEmail=credentials.match(/^المالك: (.+)$/m)?.[1];
const staffEmail=credentials.match(/^الموظف: (.+)$/m)?.[1];
const passwords=[...credentials.matchAll(/^كلمة المرور: (.+)$/gm)].map(match=>match[1]);
if(process.env.APP_ENV!=='development'||!ownerEmail||!staffEmail||passwords.length<2)throw new Error('Local recovery credentials unavailable');
const orgId='68e03472-09d3-4823-ba83-71d0bf9224bd';
const branchId='be62f391-4039-4db5-b952-5664a3fbe991';
const bayId='faf1a822-076b-40c5-adcf-18d2ff863570';
const ownerHash=await hashPassword(passwords[0]);
const staffHash=await hashPassword(passwords[1]);
try{
 if(await db.organization.findUnique({where:{id:orgId}})){console.log('Test wash already exists; no changes made.');process.exit(0);}
 if(await db.user.findFirst({where:{email:{in:[ownerEmail,staffEmail]}}}))throw new Error('Account conflict; no changes made');
 await db.$transaction(async tx=>{
  await tx.organization.create({data:{id:orgId,name:'مغسلة تجربة 385f5e00',slug:'wash-local-385f5e00',isDemo:true}});
  await tx.branch.create({data:{id:branchId,orgId,name:'مغسلة تجربة 385f5e00',city:'القاهرة'}});
  await tx.washBay.create({data:{id:bayId,orgId,branchId,name:'حوض ١'}});
  await tx.washService.create({data:{orgId,nameAr:'غسيل خارجي',nameEn:'Exterior wash',price:'80',durationMinutes:20}});
  const ownerId=randomUUID(),staffId=randomUUID(),role=`STAFF-${randomUUID()}`;
  await tx.user.create({data:{id:ownerId,name:'مالك المغسلة التجريبية',email:ownerEmail,emailVerified:true,accounts:{create:{id:randomUUID(),accountId:ownerId,providerId:'credential',password:ownerHash}}}});
  await tx.user.create({data:{id:staffId,name:'موظف تجربة',email:staffEmail,emailVerified:true,accounts:{create:{id:randomUUID(),accountId:staffId,providerId:'credential',password:staffHash}}}});
  await tx.role.create({data:{orgId,name:role,permissions:['wash.view_sessions','wash.create_session','wash.start_session','wash.pause_session','wash.complete_session']}});
  await tx.membership.createMany({data:[{orgId,userId:ownerId,role:'OWNER'},{orgId,userId:staffId,role,branchId}]});
 });
 console.log('Previous test wash owner and staff accounts restored with their existing passwords.');
}finally{await db.$disconnect();}
