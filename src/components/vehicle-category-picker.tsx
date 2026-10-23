"use client";

import Image from "next/image";
import {vehicleCategories, vehicleCategoryLabel} from "@/lib/catalog";

const images: Record<string, string> = {
  SEDAN: "/assets/sedan.webp",
  SUV: "/assets/suv.webp",
  FULL_SIZE_SUV: "/assets/4x4.webp",
  MOTORCYCLE: "/assets/motorcycle.png",
  BICYCLE: "/assets/bicycle.png",
};

export type VehicleCategoryOption={code:string;nameAr:string;nameEn:string};

export function VehicleCategoryPicker({name="category",label,locale,value,defaultValue="SEDAN",onChange,custom=[]}:{name?:string;label:string;locale:string;value?:string;defaultValue?:string;onChange?:(value:string)=>void;custom?:VehicleCategoryOption[]}){
  return <fieldset className="field vehicle-category-picker">
    <legend>{label}</legend>
    <div className="vehicle-category-options">
      {[...vehicleCategories,...custom.map(item=>item.code)].map(category=><label className="vehicle-category-option" key={category}>
        <input type="radio" name={name} value={category} checked={value===undefined?undefined:value===category} defaultChecked={value===undefined?defaultValue===category:undefined} onChange={()=>onChange?.(category)} required/>
        {images[category]&&<Image className={category==='SEDAN'?'sedan-facing-left':undefined} src={images[category]} alt="" width={180} height={90}/>}
        <span>{custom.find(item=>item.code===category)?.[locale==='ar'?'nameAr':'nameEn']??vehicleCategoryLabel(category,locale)}</span>
      </label>)}
    </div>
  </fieldset>;
}
