import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='http://localhost:3000',org='4d6c942f-43d9-446e-9ce8-168485ec07fa';
const accounts=[...(await readFile(new URL('../../opsvision-demo-accounts.txt',import.meta.url),'utf8')).matchAll(/البريد: (.+)\r?\nكلمة المرور: (.+)/g)];let checks=0;
async function login(i){const r=await fetch(base+'/api/auth/sign-in/email',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({email:accounts[i][1],password:accounts[i][2]})});assert.equal(r.status,200);checks++;return r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');}
const owner=await login(1),worker=await login(2);const url=base+`/api/v1/tenants/${org}/camera-visits`;
const response=await fetch(url,{headers:{cookie:owner}});assert.equal(response.status,200);checks++;const rows=await response.json();assert.equal(rows.length,1);const row=rows[0];assert.equal(row.category,'FULL_SIZE_SUV');assert.equal(row.categorySource,'AI_VISUAL');assert.equal(row.enteredSeconds,5.517);assert.equal(row.exitedSeconds,963.05);assert.equal(row.occupancySeconds,957.533);assert.equal(row.status,'EXITED');assert.equal(row.replay,true);assert.equal(row.washStatus,'UNCONFIRMED');assert.equal(row.enteredAt,null);checks++;
assert.equal((await fetch(url,{headers:{cookie:worker}})).status,200);checks++;
assert.equal((await fetch(url)).status,401);checks++;
assert.equal((await fetch(url+'/'+row.id,{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({category:'SUV',washed:true})})).status,401);checks++;
assert.equal((await fetch(url.replace(org,'00000000-0000-4000-8000-000000000000'),{headers:{cookie:owner}})).status,403);checks++;
console.log(`${checks} real persisted camera-visit HTTP/access checks passed: one replay, entry, exit, 4x4 estimate, no wash confirmation.`);
