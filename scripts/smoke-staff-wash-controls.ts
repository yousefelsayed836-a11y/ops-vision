import 'dotenv/config';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

if(process.env.APP_ENV!=='development')throw new Error('Development only');
const base='http://127.0.0.1:3000';
const credentials=await readFile(resolve('..','opsvision-new-wash-385f5e00-accounts.txt'),'utf8');
const staffEmail=credentials.match(/^الموظف: (.+)$/m)?.[1];
const ownerEmail=credentials.match(/^المالك: (.+)$/m)?.[1];
const ownerPassword=[...credentials.matchAll(/^كلمة المرور: (.+)$/gm)][0]?.[1];
const password=[...credentials.matchAll(/^كلمة المرور: (.+)$/gm)][1]?.[1];
assert(staffEmail&&password&&ownerEmail&&ownerPassword);
async function signIn(email:string,password:string){const login=await fetch(`${base}/api/auth/sign-in/email`,{method:'POST',headers:{origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify({email,password})});assert.equal(login.status,200);return login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');}
const cookie=await signIn(staffEmail,password);
const orgId='68e03472-09d3-4823-ba83-71d0bf9224bd';
async function request(path:string,method='GET',body?:unknown,session=cookie,expected=200){
 const response=await fetch(`${base}/api/v1/${path}`,{method,headers:{cookie:session,origin:'http://localhost:3000',...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
 assert.equal(response.status,expected,`${method} ${path}: HTTP ${response.status}`);
 return response.json();
}
const snapshot=await request(`tenants/${orgId}/snapshot`);
assert(snapshot.permissions.includes('wash.pause_session')&&snapshot.permissions.includes('wash.complete_session'));
let bay=snapshot.bays.find((item:{activeWashId:string|null;status:string})=>!item.activeWashId&&item.status==='AVAILABLE');
const service=snapshot.services.find((item:{active:boolean})=>item.active);
if(!bay){const owner=await signIn(ownerEmail,ownerPassword);bay=await request(`tenants/${orgId}/bays`,'POST',{branchId:snapshot.branches[0].id,name:`حوض اختبار ${Date.now()}`},owner,201);}
assert(bay&&service);
const wash=await request(`tenants/${orgId}/wash-entry`,'POST',{branchId:bay.branchId,bayId:bay.id,serviceId:service.id,vehicle:{category:'SEDAN'},startNow:true},cookie,201);
assert.equal(wash.status,'WASHING');
const paused=await request(`tenants/${orgId}/washes/${wash.id}/transition`,'POST',{to:'PAUSED',version:wash.version});
assert.equal(paused.status,'PAUSED');
const resumed=await request(`tenants/${orgId}/washes/${wash.id}/transition`,'POST',{to:'WASHING',version:paused.version});
assert.equal(resumed.status,'WASHING');
const finished=await request(`tenants/${orgId}/washes/${wash.id}/transition`,'POST',{to:'COMPLETED',version:resumed.version});
assert.equal(finished.status,'COMPLETED');
const directory=await fetch(`${base}/api/v1/public-wash/${snapshot.org.slug}`);
assert.equal(directory.status,200);
assert((await directory.json()).bays.some((item:{id:string})=>item.id===bay.id));
console.log('PASS: staff start/pause/resume/finish, bay release, and per-wash customer directory.');
