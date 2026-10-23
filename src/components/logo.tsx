import Image from "next/image";
export function Logo({dark=false,compact=false,variant="blue"}:{compact?:boolean;dark?:boolean;variant?:"blue"|"pink"}) {
  const source=variant==="pink"?"/assets/opsvision-car-logo-pink.png":"/assets/opsvision-car-logo-connected.png";
  return <span className={`brand brand-image ${dark?'brand-dark':''} ${compact?'brand-compact':''}`}><Image className="brand-logo-image" src={source} alt="OpsVision" width={180} height={68} unoptimized /></span>;
}
