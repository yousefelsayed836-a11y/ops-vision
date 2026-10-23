import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

if(process.env.APP_ENV!=='development')throw new Error('Local development only');
const base='http://127.0.0.1:3000',origin='http://localhost:3000';
const credentials=[...(await readFile(resolve('..','opsvision-demo-accounts.txt'),'utf8')).matchAll(/البريد:\s*([^\r\n]+)\r?\nكلمة المرور:\s*([^\r\n]+)/g)];
assert.equal(credentials.length,3,'Demo administrator missing');
const id=randomUUID().slice(0,8),name=`مغسلة تجربة ${id}`;
const ownerEmail=`wash-owner-${id}@example.test`,staffEmail=`wash-staff-${id}@example.test`;
const ownerPassword=randomBytes(24).toString('base64url'),staffPassword=randomBytes(24).toString('base64url');
let checks=0;
async function request(path:string,method='GET',payload?:unknown,cookie='',expected=200){
 const response=await fetch(`${base}/api/v1/${path}`,{method,headers:{cookie,...(payload===undefined?{}:{origin,'content-type':'application/json'})},body:payload===undefined?undefined:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
 assert.equal(response.status,expected,`${method} ${path}: HTTP ${response.status}`);checks++;
 return response.json();
}
async function login(email:string,password:string){
 const response=await fetch(`${base}/api/auth/sign-in/email`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(20000)});
 assert.equal(response.status,200,`Login ${email}: HTTP ${response.status}`);checks++;
 return response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
}
const admin=await login(credentials[0][1].trim(),credentials[0][2].trim());
const application=await request('applications','POST',{businessName:name,ownerName:'مالك المغسلة التجريبية',email:ownerEmail,phone:'+201000000001',city:'القاهرة',branchCount:1},'',201);
const approved=await request(`platform/applications/${application.id}/decision`,'POST',{status:'APPROVED'},admin);
assert(approved.orgId&&approved.invitation?.token);const orgId=approved.orgId as string;
await request('activate','POST',{token:approved.invitation.token,password:ownerPassword});
const owner=await login(ownerEmail,ownerPassword);
const snapshot=await request(`tenants/${orgId}/snapshot`,'GET',undefined,owner);
assert.equal(snapshot.org.name,name);assert.equal(snapshot.branches.length,1);const branchId=snapshot.branches[0].id;
await request(`tenants/${orgId}/snapshot`,'GET',undefined,admin,403);
const service=await request(`tenants/${orgId}/services`,'POST',{nameAr:'غسيل خارجي',nameEn:'Exterior wash',price:'80',durationMinutes:20},owner,201);
const bay=await request(`tenants/${orgId}/bays`,'POST',{branchId,name:'حوض ١'},owner,201);
const limited=['wash.view_sessions','wash.create_session','wash.start_session'];
const invite=await request(`tenants/${orgId}/invitations`,'POST',{name:'موظف تجربة',email:staffEmail,role:'STAFF',branchId,permissions:limited},owner,201);
assert(invite.token);await request('activate','POST',{token:invite.token,password:staffPassword});
const staff=await login(staffEmail,staffPassword);
const staffSnapshot=await request(`tenants/${orgId}/snapshot`,'GET',undefined,staff);
assert.deepEqual([...staffSnapshot.permissions].sort(),[...limited].sort());
await request(`tenants/${orgId}/services`,'POST',{nameAr:'خدمة ممنوعة',nameEn:'Forbidden',price:'5',durationMinutes:5},staff,403);
await request(`tenants/${orgId}/invitations`,'POST',{name:'غير مصرح',email:`forbidden-${id}@example.test`,role:'STAFF'},staff,403);
const wash=await request(`tenants/${orgId}/wash-entry`,'POST',{branchId,bayId:bay.id,serviceId:service.id,vehicle:{category:'SEDAN'},startNow:true},staff,201);
assert.equal(wash.status,'WASHING');
await request(`tenants/${orgId}/wash-entry`,'POST',{branchId,bayId:bay.id,serviceId:service.id,vehicle:{category:'SUV'},startNow:true},staff,409);
const busy=await request(`tenants/${orgId}/snapshot`,'GET',undefined,owner);
assert.equal(busy.bays.find((item:{id:string})=>item.id===bay.id)?.activeWashId,wash.id);
assert(!('plate'in busy.washes.find((item:{id:string})=>item.id===wash.id).vehicle));
await request(`tenants/${orgId}/washes/${wash.id}/transition`,'POST',{to:'COMPLETED',version:wash.version},staff,403);
const done=await request(`tenants/${orgId}/washes/${wash.id}/transition`,'POST',{to:'COMPLETED',version:wash.version},owner);
assert.equal(done.status,'COMPLETED');
const finished=await request(`tenants/${orgId}/snapshot`,'GET',undefined,owner);
assert.equal(finished.bays.find((item:{id:string})=>item.id===bay.id)?.status,'AVAILABLE');
const tracking=await request(`tenants/${orgId}/washes/${wash.id}/tracking`,'POST',{},owner,201);
assert(tracking.id&&tracking.password);await request(`tenants/${orgId}/washes/${wash.id}/tracking`,'POST',{},staff,403);
await writeFile(resolve('..',`opsvision-new-wash-${id}-accounts.txt`),`مغسلة: ${name}\nالرابط: ${origin}/ar/login\nالمالك: ${ownerEmail}\nكلمة المرور: ${ownerPassword}\nالموظف: ${staffEmail}\nكلمة المرور: ${staffPassword}\nرابط متابعة العميل: ${tracking.url ?? `${origin}/ar/track/${tracking.id}`}\nكلمة مرور المتابعة: ${tracking.password}\n`);
console.log(JSON.stringify({result:'PASS',checks,orgId,name,branchId,bayId:bay.id,washId:wash.id,credentialsFile:`opsvision-new-wash-${id}-accounts.txt`,secretsLogged:false}));
