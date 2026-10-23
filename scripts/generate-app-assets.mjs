import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),target=new URL('public/apps/',root);
await mkdir(target,{recursive:true});
for(const size of [180,192,512]){
 const inner=Math.round(size*.88);
 const logo=await sharp(fileURLToPath(new URL('public/assets/opsvision-car-logo-pink.png',root))).resize(inner,inner,{fit:'inside'}).png().toBuffer();
 await sharp({create:{width:size,height:size,channels:4,background:'#f7f9fc'}}).composite([{input:logo,gravity:'center'}]).png().toFile(fileURLToPath(new URL(`opsvision-pink-${size}.png`,target)));
}
for(const locale of ['ar','en'])await writeFile(new URL(`${locale}.webmanifest`,target),JSON.stringify({id:`/${locale}/dashboard`,name:'OpsVision — Management',short_name:'OpsVision',lang:locale,dir:locale==='ar'?'rtl':'ltr',start_url:`/${locale}/dashboard`,scope:`/${locale}/dashboard`,display:'standalone',background_color:'#f7f9fc',theme_color:'#b9dcf7',icons:[192,512].map(size=>({src:`/apps/opsvision-pink-${size}.png`,sizes:`${size}x${size}`,type:'image/png',purpose:'any'}))},null,2));
console.log('Pink dashboard icons and scoped manifests exported.');
