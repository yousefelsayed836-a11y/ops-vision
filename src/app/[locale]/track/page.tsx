import {notFound} from 'next/navigation';
import {z} from 'zod';
import {TrackingPortal} from '@/components/customer-tracking';
import {PublicWashPortal} from '@/components/public-wash-tracking';
export default async function Page({searchParams}:{searchParams:Promise<{id?:string;wash?:string}>}){const {id,wash}=await searchParams;if(wash&&/^[a-z0-9-]{3,80}$/.test(wash))return <PublicWashPortal slug={wash}/>;if(!z.uuid().safeParse(id).success)notFound();return <TrackingPortal id={id!}/>;}
