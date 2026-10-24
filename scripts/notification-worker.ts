import 'dotenv/config';
import {checkOverdueWashes,dispatchPushNotifications} from '../src/lib/push-notifications';
import {dispatchEmails} from '../src/lib/email-delivery';
import {db} from '../src/lib/db';

let running=true;
process.on('SIGINT',()=>{running=false;});
process.on('SIGTERM',()=>{running=false;});
while(running){
 try{await checkOverdueWashes();}catch(error){console.error('Overdue check failed',error instanceof Error?error.message:'unknown');}
 try{await dispatchEmails();}catch(error){console.error('Email worker failed',error instanceof Error?error.message:'unknown');}
 try{await dispatchPushNotifications();}
 catch(error){console.error('Notification worker tick failed:',error instanceof Error?error.message:'unknown');}
 await new Promise(resolve=>setTimeout(resolve,15000));
}
await db.$disconnect();
