import {db} from './db';
import {z} from 'zod';
import {assert} from './errors';
import {branchScope,type Scope} from './access';
import {createWash,createVehicle} from './operations';
import {createWashInput,vehicleInput} from './validation';
import {randomUUID} from 'node:crypto';
export async function quickWash(scope:Scope,raw:unknown){
 assert(scope.role==='CUSTOMER'?scope.permissions.includes('customers.self'):scope.permissions.includes('wash.create_session'),'FORBIDDEN',403);
 const input=raw as {vehicle?:{size?:unknown}};
 const data=createWashInput.omit({vehicleId:true}).extend({vehicle:vehicleInput.extend({plate:vehicleInput.shape.plate.optional()}),startNow:z.boolean().default(false)}).parse(raw);branchScope(scope,data.branchId);
 data.vehicle.plate ||= `AUTO-${randomUUID().replaceAll('-','')}`;
 let vehicle=await db.vehicle.findUnique({where:{orgId_plate:{orgId:scope.orgId,plate:data.vehicle.plate}}});
 if(vehicle){if(input.vehicle?.size===undefined)data.vehicle.size=vehicleInput.shape.size.parse(vehicle.size);assert(scope.role!=='CUSTOMER'||vehicle.customerUserId===scope.actor.id,'FORBIDDEN',403);assert(vehicle.category===data.vehicle.category&&vehicle.size===data.vehicle.size,'VEHICLE_DETAILS_MISMATCH',409);}else vehicle=await createVehicle(scope,data.vehicle);
 return createWash(scope,{...data,vehicleId:vehicle.id},data.startNow);
}
