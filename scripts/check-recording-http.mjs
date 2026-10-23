import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='http://localhost:3000',org='4d6c942f-43d9-446e-9ce8-168485ec07fa',id=process.argv[2];assert.match(id,/^[\da-f-]{36}$/);
const accounts=[...(await readFile(new URL('../../opsvision-demo-accounts.txt',import.meta.url),'utf8')).matchAll(/البريد: (.+)\r?\nكلمة المرور: (.+)/g)];let checks=0;
async function login(i){const r=await fetch(base+'/api/auth/sign-in/email',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({email:accounts[i][1],password:accounts[i][2]})});assert.equal(r.status,200);checks++;return r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');}
const owner=await login(1),worker=await login(2),path=`/api/v1/tenants/${org}/videos/${id}`;
async function get(suffix,cookie,status=200){const r=await fetch(base+path+suffix,{headers:{cookie}});assert.equal(r.status,status);checks++;return r;}
const detail=await(await get('',owner)).json();assert.equal(detail.status,'COMPLETED');assert.equal(detail.report.video.durationSeconds,966);assert.equal(detail.report.zoneSummary.completePassages,0);assert.equal(detail.report.operationalWrites,false);assert.ok(detail.config.bayId);if(detail.report.automation){assert.equal(detail.report.automation.completedBayVisits,1);assert.equal(detail.report.automation.events.length,2);assert.equal(detail.report.automation.events[0].videoSeconds,5.517);assert.equal(detail.report.automation.events[1].videoSeconds,963.05);}assert.equal(detail.report.tracks.length,7);
await get('',worker,403);await get('','',401);
const report=await get('/files/report',owner);assert.match(report.headers.get('cache-control'),/private/);assert.equal((await report.json()).source,'VIDEO_FILE');
const evidence=await get('/files/'+detail.report.tracks[0].evidenceFile,owner);assert.match(evidence.headers.get('content-type'),/image\/jpeg/);await get('/files/'+detail.report.tracks[0].evidenceFile,'',401);
const ranged=await fetch(base+path+'/files/source',{headers:{cookie:owner,range:'bytes=0-15'}});assert.equal(ranged.status,206);assert.equal((await ranged.arrayBuffer()).byteLength,16);checks++;
console.log(`${checks} actual recording HTTP/access checks passed.`);
