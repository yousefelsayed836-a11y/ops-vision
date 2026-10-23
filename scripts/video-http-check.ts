import 'dotenv/config';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {db} from '../src/lib/db';
if(process.env.APP_ENV!=='development')throw Error('Local development only');
const base='http://127.0.0.1:3000',origin='http://localhost:3000';
async function main(){
 const credentials=await readFile('../opsvision-demo-accounts.txt','utf8');
 const pairs=[...credentials.matchAll(/البريد: (.+)\r?\nكلمة المرور: (.+)/g)];assert.equal(pairs.length,3);
 async function login(index:number){const response=await fetch(base+'/api/auth/sign-in/email',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:pairs[index][1].trim(),password:pairs[index][2].trim()})});assert.equal(response.status,200);return response.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');}
 const cookie=await login(1);const me=await (await fetch(base+'/api/v1/me',{headers:{cookie}})).json();const orgId=me.memberships[0].orgId;
 const snapshot=await (await fetch(`${base}/api/v1/tenants/${orgId}/snapshot`,{headers:{cookie}})).json();const url=`${base}/api/v1/tenants/${orgId}/videos`;
 assert.equal((await fetch(url)).status,401);
 const workerCookie=await login(2);assert.equal((await fetch(url,{headers:{cookie:workerCookie}})).status,403);
 const bad=new FormData();bad.set('video',new File([new Uint8Array(20)],'fake.mp4'));bad.set('config','{');assert.equal((await fetch(url,{method:'POST',headers:{cookie,origin},body:bad})).status,422);
 assert.equal((await fetch(url,{method:'POST',headers:{cookie,origin:'https://invalid.example'},body:new FormData()})).status,403);
 let job=process.argv.includes('--rerun')?null:await db.videoAnalysis.findFirst({where:{orgId,sourceName:'vfx.mp4'},orderBy:{createdAt:'desc'}});
 if(!job){const data=new FormData();data.set('video',new File([await readFile('.data/video-input/vfx.mp4')],'vfx.mp4',{type:'video/mp4'}));data.set('config',JSON.stringify({branchId:snapshot.branches[0].id}));const response=await fetch(url,{method:'POST',headers:{cookie,origin},body:data});assert.equal(response.status,202);const result=await response.json();job=await db.videoAnalysis.findUniqueOrThrow({where:{id:result.id}});}
 const detail=await fetch(`${url}/${job.id}`,{headers:{cookie}});assert.equal(detail.status,200);
 const privateFile=await fetch(`${url}/${job.id}/files/source`,{headers:{cookie,range:'bytes=0-15'}});assert.equal(privateFile.status,206);assert.equal((await privateFile.arrayBuffer()).byteLength,16);
 assert.equal((await fetch(`${url}/${job.id}/files/source`)).status,401);
 const adminCookie=await login(0);assert.equal((await fetch(`${url}/${job.id}`,{headers:{cookie:adminCookie}})).status,403);
 await writeFile('../video-analysis-vfx/site-job.json',JSON.stringify({id:job.id,orgId,status:job.status},null,2));
 console.log(JSON.stringify({checks:10,jobId:job.id,status:job.status}));
}
main().catch(()=>{console.error('Video HTTP verification failed; no credentials logged.');process.exitCode=1;}).finally(()=>db.$disconnect());
