import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const base='http://localhost:3000';
const text=await readFile(new URL('../../opsvision-demo-accounts.txt',import.meta.url),'utf8');
const accounts=[...text.matchAll(/البريد: (.+)\r?\nكلمة المرور: (.+)/g)];
let checks=0;
async function login(index){const r=await fetch(base+'/api/auth/sign-in/email',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({email:accounts[index][1],password:accounts[index][2]})});assert.equal(r.status,200);checks++;return r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');}
async function request(path,cookie,status=200){const r=await fetch(base+'/api/v1/'+path,{headers:{cookie}});assert.equal(r.status,status,path);checks++;return r.json();}
const org='4d6c942f-43d9-446e-9ce8-168485ec07fa';
const admin=await login(0),owner=await login(1),worker=await login(2);
const grouped=await request('platform/bays',admin);assert.ok(grouped.organizations.some(x=>x.id===org));assert.ok(grouped.bays.some(x=>x.orgId===org));
await request('platform/bays',owner,403);
const all=await request(`tenants/${org}/statistics?date=all`,owner);assert.equal(all.orgId,org);
const day=await request(`tenants/${org}/statistics?date=2026-10-19`,owner);assert.equal(day.date,'2026-10-19');
await request(`tenants/${org}/statistics?date=2026-02-30`,owner,422);
await request(`tenants/${org}/customers`,owner);
await request(`tenants/${org}/videos`,owner);
await request(`tenants/${org}/customers`,worker,403);
for(const removed of ['rules','observations'])await request(`tenants/${org}/${removed}`,owner,410);
for(const locale of ['ar','en']){
 const r=await fetch(base+`/apps/${locale}.webmanifest`);assert.equal(r.status,200);const m=await r.json();assert.equal(m.start_url,`/${locale}/dashboard`);assert.equal(m.scope,`/${locale}/dashboard`);assert.deepEqual(m.icons.map(x=>x.sizes),['192x192','512x512']);checks++;
 for(const icon of m.icons){const image=await fetch(base+icon.src);assert.equal(image.status,200);const meta=await sharp(Buffer.from(await image.arrayBuffer())).metadata();assert.equal(`${meta.width}x${meta.height}`,icon.sizes);checks++;}
}
console.log(`${checks} authenticated HTTP and install asset checks passed.`);
