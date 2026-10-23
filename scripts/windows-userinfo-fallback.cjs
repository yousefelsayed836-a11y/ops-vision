// Some Windows sessions report ENOMEM from uv_os_get_passwd even with free RAM.
// tsx only needs the username to choose a temporary directory.
if(process.platform==='win32'){
 // eslint-disable-next-line @typescript-eslint/no-require-imports
 const os=require('node:os');
 const original=os.userInfo;
 os.userInfo=function(...args){
  try{return original.apply(this,args);}catch(error){
   if(error?.info?.syscall!=='uv_os_get_passwd'||!process.env.USERNAME)throw error;
   return {username:process.env.USERNAME,uid:-1,gid:-1,homedir:process.env.USERPROFILE??os.homedir(),shell:null};
  }
 };
}
