"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import {useLocale,useTranslations} from "next-intl";
import {VideoZonePicker,type CameraRegion} from "./video-zone-picker";
import {cameraCalibrationInput} from "@/lib/camera-calibration";
import {api} from "@/lib/client";
import type {VideoReport} from "@/lib/video-analysis";
import type {Branch,Bay,Camera,Service} from "./types";
type Job={id:string;sourceName:string;status:string;errorCode:string|null};
type Review={trackId:string;category:string;size:string;serviceId:string|null;washed:boolean|null;note:string};
type Detail=Job&{progress?:number|null;config:{bayId?:string;rotation?:number};branchId:string;report:VideoReport|null;reviews:Review[];confirmedWashedCount:number};
export function VideoAnalysisPanel({orgId,branches,bays,cameras,services,canCalibrate=false,onCalibrationSaved}:{onCalibrationSaved?:()=>Promise<void>;canCalibrate?:boolean;orgId:string;branches:Branch[];bays:Bay[];cameras:Camera[];services:Service[]}){
 const t=useTranslations("video"),locale=useLocale();
 const [jobs,setJobs]=useState<Job[]>([]),[selected,setSelected]=useState(""),[detail,setDetail]=useState<Detail|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[branch,setBranch]=useState(branches[0]?.id??"");
 const [preview,setPreview]=useState<File|null>(null),[rotation,setRotation]=useState(0),[region,setRegion]=useState<CameraRegion|null>(null);
 const [showOutside,setShowOutside]=useState(false);
 const [gateEnabled,setGateEnabled]=useState(false),[entryY,setEntryY]=useState(.4),[exitY,setExitY]=useState(.28),[cameraId,setCameraId]=useState(''),[selectedBay,setSelectedBay]=useState(''),[calibrationMessage,setCalibrationMessage]=useState('');
 function chooseCamera(id:string){setCameraId(id);setCalibrationMessage('');const camera=cameras.find(c=>c.id===id);setSelectedBay(camera?.bayId??'');const parsed=cameraCalibrationInput.safeParse(camera?.zones);if(parsed.success){setRotation(parsed.data.rotation);setEntryY(parsed.data.gate.entryY);setExitY(parsed.data.gate.exitY);setRegion({x:parsed.data.gate.xMin,y:0,width:parsed.data.gate.xMax-parsed.data.gate.xMin,height:1});setGateEnabled(true);}else {setGateEnabled(false);setRegion(null);setRotation(0);}}
 function gate(){if(!region)throw Error();return {xMin:region.x,xMax:region.x+region.width,entryY,exitY,confirmations:2,confidence:.2};}
 async function saveCalibration(){if(!cameraId||!canCalibrate)return;setBusy(true);setCalibrationMessage('');try{await api(`tenants/${orgId}/cameras/${cameraId}/calibration`,'POST',{rotation,gate:gate()});setCalibrationMessage(t('gateSaved'));await onCalibrationSaved?.();}catch{setError(t('error'));}finally{setBusy(false);}}
 const base=`tenants/${orgId}/videos`;
 const refresh=useCallback(async()=>{try{setJobs(await api<Job[]>(base));if(selected)setDetail(await api<Detail>(`${base}/${selected}`));}catch{setError(t("error"));}},[base,selected,t]);
 useEffect(()=>{const initial=setTimeout(()=>void refresh(),0);const timer=setInterval(()=>void refresh(),5000);return()=>{clearTimeout(initial);clearInterval(timer);};},[refresh]);
 async function upload(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");const form=e.currentTarget;try{
  const values=new FormData(form),file=values.get("video");if(!(file instanceof File)||file.size>128*1024*1024)throw Error();
  const config:{branchId:string;cameraId?:string;bayId?:string;rotation:number;sampleFps:number;recordingStartedAt?:string;gate?:ReturnType<typeof gate>;zone?:{x:number;y:number;width:number;height:number}}={branchId:branch,rotation:Number(values.get("rotation")),sampleFps:Number(values.get("sampleFps"))};if(values.get("bayId"))config.bayId=String(values.get("bayId"));if(values.get("recordingStartedAt"))config.recordingStartedAt=new Date(String(values.get("recordingStartedAt"))).toISOString();if(values.get("cameraId"))config.cameraId=String(values.get("cameraId"));
  if(region)config.zone=region;
  if(gateEnabled)config.gate=gate();
  const payload=new FormData();payload.set("video",file);payload.set("config",JSON.stringify(config));
  const response=await fetch(`/api/v1/${base}`,{method:"POST",body:payload,credentials:"same-origin"});if(!response.ok)throw Error();const job=await response.json() as Job;setSelected(job.id);form.reset();setPreview(null);setRegion(null);await refresh();
 }catch{setError(t("error"));}finally{setBusy(false);}}
 async function review(e:FormEvent<HTMLFormElement>,trackId:string){e.preventDefault();setBusy(true);setError("");try{const values=Object.fromEntries(new FormData(e.currentTarget));await api(`${base}/${selected}/reviews`,"POST",{trackId,category:values.category,serviceId:values.serviceId||undefined,washed:values.washed==="yes"?true:values.washed==="no"?false:null,note:values.note});await refresh();}catch{setError(t("error"));}finally{setBusy(false);}}
 const visibleTracks=detail?.report?.tracks.filter(track=>!detail.report?.zoneConfigured||showOutside||!!track.visits?.length)??[];
 const fileUrl=(kind:string)=>`/api/v1/${base}/${selected}/files/${kind}`;
 return <div className="video-analysis">
  <section className="panel"><h2>{t("upload")}</h2><p className="muted">{t("limits")}</p>
   <form onSubmit={upload} className="form-fields">
    <label className="field">{t("branch")}<select required value={branch} onChange={e=>{setBranch(e.target.value);chooseCamera('');}}>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
    <label className="field">{t("camera")}<select name="cameraId" value={cameraId} onChange={e=>chooseCamera(e.target.value)} key={branch}><option value="">{t("noCamera")}</option>{cameras.filter(c=>c.branchId===branch).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label className="field">{t("bay")}<select name="bayId" value={selectedBay} onChange={e=>setSelectedBay(e.target.value)} key={branch+"bay"}><option value="">{t("noBay")}</option>{bays.filter(b=>b.branchId===branch).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
    <label className="field">{t("rotation")}<select name="rotation" value={rotation} onChange={e=>{setRotation(Number(e.target.value));setRegion(null);}}>{[0,90,180,270].map(value=><option key={value} value={value}>{value}°</option>)}</select></label>
    <label className="field">{t("sampling")}<select name="sampleFps" defaultValue="1"><option value="0.5">{t("samplingSlow")}</option><option value="1">{t("samplingNormal")}</option><option value="4">{t("samplingFast")}</option></select></label>
    <label className="field">{t("recordingStart")}<input name="recordingStartedAt" type="datetime-local"/><small>{t("recordingHint")}</small></label>
    <label className="field">{t("file")}<input type="file" name="video" accept="video/mp4,.mp4" required onChange={e=>{setPreview(e.target.files?.[0]??null);setRegion(null);}}/></label>
    <details className="gate-calibration-controls"><summary>{t('gateSetup')}</summary><label><input type="checkbox" checked={gateEnabled} onChange={e=>setGateEnabled(e.target.checked)}/> {t('enableGate')}</label><p className="muted">{t('gateHelp')}</p>{gateEnabled&&<div className="form-fields"><label className="field">{t('entryLine')}<input type="number" min="3" max="100" value={Math.round(entryY*100)} onChange={e=>setEntryY(Number(e.target.value)/100)}/></label><label className="field">{t('exitLine')}<input type="number" min="0" max="97" value={Math.round(exitY*100)} onChange={e=>setExitY(Number(e.target.value)/100)}/></label>{canCalibrate&&cameraId&&<button type="button" className="button outline" disabled={busy||!region} onClick={()=>void saveCalibration()}>{t('saveGate')}</button>}</div>}{calibrationMessage&&<p role="status">{calibrationMessage}</p>}</details>
    <VideoZonePicker gateLines={gateEnabled?{entryY,exitY}:undefined} file={preview} rotation={rotation} region={region} onChange={setRegion} label={t("drawZone")} timeLabel={t("previewTime")}/>
    <details><summary>{t("zone")}</summary><p className="muted">{t("zoneHelp")}</p><div className="form-fields">{["x","y","width","height"].map((key,i)=><label className="field" key={key}>{t(key)}<input type="number" min={i<2?0:1} max="100" value={Math.round((region?.[key as keyof CameraRegion]??(i<2?0:1))*100)} onChange={e=>setRegion({...region??{x:0,y:0,width:1,height:1},[key]:Number(e.target.value)/100})}/></label>)}</div><button className="button outline" type="button" onClick={()=>setRegion(null)}>{t("clearZone")}</button></details>
    <button className="button primary" disabled={busy||!branch}>{busy?t("busy"):t("start")}</button>
   </form>{error&&<p role="alert" className="error-text">{error}</p>}
  </section>
  <section className="panel"><h2>{t("jobs")}</h2>{jobs.length===0&&<p>{t("empty")}</p>}<div className="video-job-list">{jobs.map(job=><button className={`button ${selected===job.id?"primary":"outline"}`} key={job.id} onClick={()=>{setSelected(job.id);setDetail(null);setShowOutside(false);}}>{job.sourceName} · {t(`status.${job.status}`)}</button>)}</div></section>
  {detail&&<section className="panel"><h2>{detail.sourceName}</h2><p className="muted">{branches.find(b=>b.id===detail.branchId)?.name} · {bays.find(b=>b.id===detail.config?.bayId)?.name??t("noBay")}</p><p>{t(`status.${detail.status}`)}{detail.progress!=null?` — ${detail.progress}%`:""}</p>{detail.status==="FAILED"&&<p role="alert">{t("failed")}</p>}
   {detail.report&&<><div className="stat-grid"><article className="stat-card"><span>{t(detail.report.automation?"bayVisits":"tracks")}</span><strong>{detail.report.automation?.completedBayVisits??visibleTracks.length}</strong></article><article className="stat-card"><span>{t("confirmed")}</span><strong>{detail.confirmedWashedCount}</strong></article><article className="stat-card"><span>{t("duration")}</span><strong>{detail.report.video.durationSeconds.toFixed(1)} {t("seconds")}</strong></article></div>
   {detail.report.zoneSummary&&<p>{t("entries")}: {(detail.report.automation?.events.filter(e=>e.type==='vehicle.entered_bay').length??detail.report.zoneSummary.observedEntries)} · {t("exits")}: {(detail.report.automation?.events.filter(e=>e.type==='vehicle.exited_bay').length??detail.report.zoneSummary.observedExits)} · {t("completePassages")}: {(detail.report.automation?.completedBayVisits??detail.report.zoneSummary.completePassages)}</p>}
   {detail.report.automation&&<div className="management-active-wash"><h3>{t("engineResult")}</h3>{detail.report.automation.cycles.map((cycle,i)=><div key={i}><p>{t("entry")}: {cycle.entrySeconds?.toFixed(2)??t("unknown")} {t("seconds")} · {t("exit")}: {cycle.exitSeconds?.toFixed(2)??t("unknown")} {t("seconds")}</p><p>{t("occupancy")}: {cycle.bayOccupancySeconds?.toFixed(2)??t("unknown")} {t("seconds")}</p></div>)}<small>{t("occupancyHelp")}</small></div>}
   <p className="muted">{t("warning")}</p><video key={selected} className="analysis-player" controls preload="metadata" src={fileUrl("source")}/><p><a className="button outline" href={fileUrl("report")}>{t("download")}</a></p>
   <details open={detail.report.automation?undefined:true}><summary>{t("rawTrackDetails")}</summary><p className="muted">{t("rawTrackHelp")}</p>
   {detail.report.zoneConfigured&&<label><input type="checkbox" checked={showOutside} onChange={e=>setShowOutside(e.target.checked)}/> {t("showOutside")}</label>}
   <div className="video-tracks">{visibleTracks.map(track=>{const latest=detail.reviews.filter(r=>r.trackId===track.trackId).at(-1);return <article className="video-track" key={track.trackId}>
    {/* Evidence is authenticated and private; browser session authorizes the image. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img loading="lazy" src={fileUrl(track.evidenceFile)} alt={`${t("evidence")} ${track.trackId}`}/>
    <h3>{track.trackId}</h3><p>{t("seen")}: {track.firstSeenSeconds.toFixed(2)}–{track.lastSeenSeconds.toFixed(2)} {t("seconds")}</p><p>{t("span")}: {track.observedSpanSeconds.toFixed(2)} {t("seconds")}</p><p>{t("washDuration")}: {t("unknown")}</p><p>{t("confidence")}: {(track.confidence*100).toFixed(0)}%</p>{(track.leftCensored||track.rightCensored)&&<p className="muted">{t("partial")}</p>}
    {track.visits?.map((visit,i)=><div className="management-active-wash" key={i}><p>{t("entry")}: {visit.entrySeconds===null?t("unseen"):visit.entrySeconds.toFixed(1)+" "+t("seconds")}</p><p>{t("exit")}: {visit.exitSeconds===null?t("unseen"):visit.exitSeconds.toFixed(1)+" "+t("seconds")}</p><p>{t("dwell")}: {visit.durationSeconds===null?t("partial"):visit.durationSeconds.toFixed(1)+" "+t("seconds")}</p></div>)}
    {track.zoneIntervals.map((zone,i)=><p key={i}>{t("zoneTime")}: {zone.seconds.toFixed(2)} {t("seconds")}{zone.leftCensored||zone.rightCensored?` (${t("partial")})`:""}</p>)}
    <form key={`${track.trackId}-${detail.reviews.length}`} onSubmit={e=>review(e,track.trackId)} className="form-fields">
     <label className="field">{t("category")}<select name="category" defaultValue={latest?.category??"UNKNOWN"}>{["UNKNOWN","SEDAN","SUV","FULL_SIZE_SUV"].map(value=><option key={value} value={value}>{t(`categories.${value}`)}</option>)}</select></label>
     <label className="field">{t("service")}<select name="serviceId" defaultValue={latest?.serviceId??""}><option value="">{t("unknown")}</option>{services.map(s=><option value={s.id} key={s.id}>{locale==="ar"?s.nameAr:s.nameEn}</option>)}</select></label>
     <label className="field">{t("washed")}<select name="washed" defaultValue={latest?.washed===true?"yes":latest?.washed===false?"no":"unknown"}>{["unknown","yes","no"].map(value=><option key={value} value={value}>{t(value)}</option>)}</select></label>
     <label className="field">{t("note")}<textarea name="note" maxLength={1000} defaultValue={latest?.note??""}/></label><button className="button outline" disabled={busy}>{t("saveReview")}</button>
    </form>
   </article>;})}</div></details></>}
  </section>}
 </div>;
}
