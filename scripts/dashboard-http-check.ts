import 'dotenv/config';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {db} from '../src/lib/db';
if(process.env.APP_ENV!=='development')throw Error('Local only');
const base='http://127.0.0.1:3000',origin='http://localhost:3000';
async function main(){
 const pairs=[...(await readFile('../opsvision-demo-accounts.txt','utf8')).matchAll(/البريد: (.+)\r?\nكلمة المرور: (.+)/g)];assert.equal(pairs.length,3);let checks=0;
 async function request(path:string,method='GET',body?:unknown,cookie='',expected=200){const response=await fetch(base+'/api/v1/'+path,{method,headers:{cookie,...(body!==undefined?{origin,'content-type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});assert.equal(response.status,expected,`${method} ${path}`);checks++;return response;}
 async function login(index:number){const r=await fetch(base+'/api/auth/sign-in/email',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:pairs[index][1].trim(),password:pairs[index][2].trim()})});assert.equal(r.status,200);return r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');}
 const owner=await login(1),admin=await login(0),worker=await login(2);const me=await (await request('me','GET',undefined,owner)).json(),orgId=me.memberships[0].orgId;
 const snapshot=await (await request(`tenants/${orgId}/snapshot`,'GET',undefined,owner)).json();const washId=snapshot.washes[0].id;
 await request('platform/bays','GET',undefined,owner,403);await request('platform/bays','GET',undefined,admin);await request('platform/start-wash','POST',{},worker,403);
 await request(`tenants/${orgId}/washes/${washId}/tracking`,'POST',{},worker,403);
 const issued=await (await request(`tenants/${orgId}/washes/${washId}/tracking`,'POST',{},owner,201)).json();
 await request(`tracking/${issued.id}`,'GET',undefined,'',401);await request(`tracking/${issued.id}/login`,'POST',{password:'wrong'},'',401);
 const signed=await request(`tracking/${issued.id}/login`,'POST',{password:issued.password});assert(signed.headers.getSetCookie().some(c=>/HttpOnly/i.test(c)&&/SameSite=Strict/i.test(c)&&c.includes(`Path=/api/v1/tracking/${issued.id}`)));const cookie=signed.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
 const status=await (await request(`tracking/${issued.id}`,'GET',undefined,cookie)).json();assert(!('plate'in status));assert(!('price'in status));
 await request(`tenants/${orgId}/snapshot`,'GET',undefined,cookie,401);
 await request(`tenants/${orgId}/washes/${washId}/tracking`,'POST',{},owner,201);await request(`tracking/${issued.id}`,'GET',undefined,cookie,401);
 const testOrg=await db.organization.create({data:{name:'Disposable HTTP archive test',slug:'http-archive-'+randomUUID(),isDemo:true}});
 await request(`platform/organizations/${testOrg.id}`,'PATCH',{status:'ARCHIVED'},owner,403);
 await request(`platform/organizations/${testOrg.id}`,'PATCH',{status:'ARCHIVED'},admin);
 assert.equal((await db.organization.findUniqueOrThrow({where:{id:testOrg.id}})).status,'ARCHIVED');
 await request(`platform/organizations/${testOrg.id}`,'PATCH',{status:'ACTIVE'},admin);
 await request(`platform/organizations/${testOrg.id}`,'PATCH',{status:'ARCHIVED'},admin);
 console.log(JSON.stringify({checks,result:'PASS',credentialsLogged:false}));
}
main().catch(error=>{console.error(error instanceof assert.AssertionError?error.message:'Dashboard checks failed; secrets suppressed.');process.exitCode=1;}).finally(()=>db.$disconnect());
