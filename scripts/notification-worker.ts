import 'dotenv/config';
import {checkOverdueWashes,dispatchPushNotifications} from '../src/lib/push-notifications';
import {db} from '../src/lib/db';

let running=true;
process.on('SIGINT',()=>{running=false;});
process.on('SIGTERM',()=>{running=false;});
while(running){
 try{await checkOverdueWashes();await dispatchPushNotifications();}
 catch(error){console.error('Notification worker tick failed:',error instanceof Error?error.message:'unknown');}
 await new Promise(resolve=>setTimeout(resolve,15000));
}
await db.$disconnect();
