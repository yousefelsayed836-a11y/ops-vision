import 'dotenv/config';
import {db} from '../src/lib/db';

if(process.env.APP_ENV!=='development')throw new Error('Development database only');
const orgId='68e03472-09d3-4823-ba83-71d0bf9224bd';
try{
 const membership=await db.membership.findFirst({where:{orgId,role:{startsWith:'STAFF-'}}});
 if(!membership)throw new Error('Test wash staff membership not found');
 const role=await db.role.findFirst({where:{orgId,name:membership.role}});
 if(!role)throw new Error('Test wash staff role not found');
 const permissions=[...new Set([...role.permissions,'wash.pause_session','wash.complete_session'])];
 await db.role.update({where:{id:role.id},data:{permissions}});
 console.log('Test wash staff can now pause and finish washes.');
}finally{await db.$disconnect();}
