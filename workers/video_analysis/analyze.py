"""Local YOLOX/OpenCV video observations. Never equate presence with a completed wash."""
import argparse, hashlib, json, math, sys, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'.data/vision-python'))
sys.path.append(str(ROOT/'.data/python'))
import cv2
import numpy as np

LABELS={2:'CAR',3:'MOTORCYCLE',5:'BUS',7:'TRUCK'}
def overlap(a,b):
    left=max(a[0],b[0]);top=max(a[1],b[1]);right=min(a[2],b[2]);bottom=min(a[3],b[3])
    intersection=max(0,right-left)*max(0,bottom-top)
    return intersection/max(1,(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-intersection)

class Detector:
    def __init__(self,path):
        self.net=cv2.dnn.readNetFromONNX(str(path));self.size=640
        self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
        self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
        coordinates=[];strides=[]
        for stride in [8,16,32]:
            y,x=np.indices((self.size//stride,self.size//stride))
            coordinates.append(np.stack([x.ravel(),y.ravel()],axis=1));strides.extend([stride]*x.size)
        self.grid=np.concatenate(coordinates);self.strides=np.array(strides)[:,None]
    def detect(self,frame,threshold,min_area):
        height,width=frame.shape[:2];ratio=min(self.size/height,self.size/width)
        padded=np.full((self.size,self.size,3),114,dtype=np.uint8)
        resized=cv2.resize(frame,(round(width*ratio),round(height*ratio)))
        padded[:resized.shape[0],:resized.shape[1]]=resized
        self.net.setInput(cv2.dnn.blobFromImage(padded,1.0,(self.size,self.size),swapRB=False))
        output=self.net.forward().reshape(-1,85)
        centers=(output[:,:2]+self.grid)*self.strides
        sizes=np.exp(np.clip(output[:,2:4],-12,12))*self.strides
        scores=output[:,4,None]*output[:,5:]
        categories=np.argmax(scores,axis=1);confidence=np.max(scores,axis=1)
        mask=np.isin(categories,list(LABELS))&(confidence>=threshold)
        candidates=[]
        for center,size,score,category in zip(centers[mask],sizes[mask],confidence[mask],categories[mask]):
            x1,y1=np.maximum(0,(center-size/2)/ratio);x2,y2=np.minimum([width,height],(center+size/2)/ratio)
            if (x2-x1)*(y2-y1)<min_area*width*height:continue
            crop=frame[int(y1+(y2-y1)*.15):int(y2-(y2-y1)*.15),int(x1+(x2-x1)*.1):int(x2-(x2-x1)*.1)]
            if not crop.size:continue
            hsv=cv2.cvtColor(crop,cv2.COLOR_BGR2HSV);appearance=cv2.calcHist([hsv],[0,1],None,[18,8],[0,180,0,256]);cv2.normalize(appearance,appearance)
            candidates.append({'box':[float(x1),float(y1),float(x2),float(y2)],'confidence':float(score),'class':LABELS[int(category)],'appearance':appearance})
        if not candidates:return []
        indices=cv2.dnn.NMSBoxes([[d['box'][0],d['box'][1],d['box'][2]-d['box'][0],d['box'][3]-d['box'][1]] for d in candidates],[d['confidence'] for d in candidates],threshold,.45)
        return [candidates[int(i)] for i in np.array(indices).flatten()]

class Tracker:
    def __init__(self,width,height,max_gap=2.0):self.tracks=[];self.width=width;self.height=height;self.max_gap=max_gap
    def update(self,detections,t,scene=0):
        pairs=[]
        for i,track in enumerate(self.tracks):
            if t-track['last']>self.max_gap or track['scene']!=scene:continue
            for j,d in enumerate(detections):
                a=track['box'];b=d['box'];iou=overlap(a,b)
                distance=math.hypot(((a[0]+a[2])-(b[0]+b[2]))/(2*self.width),((a[1]+a[3])-(b[1]+b[3]))/(2*self.height))
                area_ratio=((b[2]-b[0])*(b[3]-b[1]))/max(1,(a[2]-a[0])*(a[3]-a[1]))
                appearance=cv2.compareHist(track['appearance'],d['appearance'],cv2.HISTCMP_BHATTACHARYYA) if 'appearance' in track and 'appearance' in d else 0
                # Color can change sharply under spray/shadow. Strong spatial continuity
                # should survive appearance disagreement; disjoint matches still need it.
                if .25<area_ratio<4 and (appearance<.68 or iou>.2) and (iou>.08 or distance<.09):pairs.append((iou-distance-.6*appearance,i,j))
        used_tracks=set();used_detections=set()
        for _,i,j in sorted(pairs,reverse=True):
            if i in used_tracks or j in used_detections:continue
            self.add(self.tracks[i],detections[j],t);used_tracks.add(i);used_detections.add(j)
        for j,d in enumerate(detections):
            if j in used_detections:continue
            track={'id':f'V{len(self.tracks)+1:03}','first':t,'last':t,'box':d['box'],'scene':scene,'samples':[]}
            self.tracks.append(track);self.add(track,d,t)
    def add(self,track,detection,t):
        track['last']=t;track['box']=detection['box']
        if 'appearance' in detection:track['appearance']=.8*track.get('appearance',detection['appearance'])+.2*detection['appearance']
        track['samples'].append({'t':round(t,3),**detection})

def analyze(video,model,out,config):
    started=time.monotonic();cv2.setNumThreads(2)
    out.mkdir(parents=True,exist_ok=True)
    cache_path=out/'detections.jsonl';cached={}
    if cache_path.exists():
        for line in cache_path.read_text(encoding='utf8').splitlines():
            try:
                item=json.loads(line);cached[item['frame']]=item['detections']
            except (ValueError,KeyError):continue
    cap=cv2.VideoCapture(str(video))
    if not cap.isOpened():raise ValueError('VIDEO_DECODE_FAILED')
    fps=cap.get(cv2.CAP_PROP_FPS);total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT));width=int(cap.get(cv2.CAP_PROP_FRAME_WIDTH));height=int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if not 0<fps<=240 or not 0<width<=4096 or not 0<height<=4096 or not total>0 or total/fps>1800:raise ValueError('VIDEO_LIMIT_EXCEEDED')
    from video_cache import inference_identity
    identity,source_hash,model_hash=inference_identity(video,model,config)
    identity_path=out/'cache-identity.txt'
    if not identity_path.exists() or identity_path.read_text()!=identity:
        cached={};cache_path.unlink(missing_ok=True);identity_path.write_text(identity)
    duration=total/fps;requested_fps=min(6,max(.2,float(config.get('sampleFps',1))));step=max(1,round(fps/requested_fps));actual_fps=fps/step
    threshold=float(config.get('threshold',.32));min_area=float(config.get('minAreaRatio',.006))
    rotation=int(config.get('rotation',0));
    if rotation not in [0,90,180,270]:raise ValueError('INVALID_ROTATION')
    if rotation in [90,270]:width,height=height,width
    detector=Detector(model);tracker=Tracker(width,height,max_gap=max(2.0,3/actual_fps));index=0;frames_processed=0;snapshots={};last_hist=None;scene=0;cut_times=[]
    while True:
        ok,frame=cap.read()
        if not ok:break
        if index%step:index+=1;continue
        if time.monotonic()-started>1800:raise ValueError('ANALYSIS_TIMEOUT')
        if rotation:frame=cv2.rotate(frame,{90:cv2.ROTATE_90_CLOCKWISE,180:cv2.ROTATE_180,270:cv2.ROTATE_90_COUNTERCLOCKWISE}[rotation])
        pts=cap.get(cv2.CAP_PROP_POS_MSEC)/1000
        t=pts if math.isfinite(pts) and pts>=0 and (index==0 or pts>0) else index/fps
        if index in cached:
            detections=[{**d,'appearance':np.array(d['appearance'],dtype=np.float32)} for d in cached[index]]
        else:
            detections=detector.detect(frame,threshold,min_area)
            with cache_path.open('a',encoding='utf8') as cache:
                cache.write(json.dumps({'frame':index,'detections':[{**d,'appearance':d['appearance'].tolist()} for d in detections]})+'\n')
        hist=cv2.calcHist([frame],[0,1],None,[16,16],[0,256,0,256]);cv2.normalize(hist,hist)
        if last_hist is not None and cv2.compareHist(last_hist,hist,cv2.HISTCMP_BHATTACHARYYA)>.8:scene+=1;cut_times.append(round(t,3))
        last_hist=hist;tracker.update(detections,t,scene);frames_processed+=1
        for track in tracker.tracks:
            if track['last']!=t:continue
            sample=track['samples'][-1]
            if track['id'] not in snapshots or sample['confidence']>snapshots[track['id']][0]:snapshots[track['id']]=(sample['confidence'],frame.copy(),sample['box'],t)
        index+=1
        if frames_processed%20==0:
            progress={'progress':min(99,round(index/total*100)),'framesProcessed':frames_processed,'status':'PROCESSING'}
            (out/'progress.json').write_text(json.dumps(progress),encoding='utf8');print(json.dumps(progress),flush=True)
    cap.release();out.mkdir(parents=True,exist_ok=True);results=[]
    region=config.get('zone');polygon=None
    if region:polygon=np.array([[region['x']*width,region['y']*height],[(region['x']+region['width'])*width,region['y']*height],[(region['x']+region['width'])*width,(region['y']+region['height'])*height],[region['x']*width,(region['y']+region['height'])*height]],dtype=np.float32)
    for track in tracker.tracks:
        if len(track['samples'])<3:continue
        samples=track['samples'];inside=[]
        for sample in samples:
            b=sample['box'];inside.append(polygon is not None and cv2.pointPolygonTest(polygon,((b[0]+b[2])/2,(b[1]+b[3])/2 if config.get('zoneAnchor')=='center' else b[3]),False)>=0)
        intervals=[];begin=None
        for i,value in enumerate(inside+[False]):
            if value and begin is None:begin=i
            if not value and begin is not None:
                intervals.append({'start':samples[begin]['t'],'end':samples[i-1]['t'],'seconds':round(samples[i-1]['t']-samples[begin]['t'],3),'leftCensored':begin==0,'rightCensored':i==len(samples)})
                begin=None
        best=snapshots[track['id']];evidence=best[1];x1,y1,x2,y2=map(int,best[2]);cv2.rectangle(evidence,(x1,y1),(x2,y2),(245,195,120),2)
        cv2.putText(evidence,f"{track['id']} | {best[3]:.2f}s | observation",(max(0,x1),max(20,y1-8)),cv2.FONT_HERSHEY_SIMPLEX,.6,(140,85,35),2)
        scale=min(1,900/max(width,height));evidence=cv2.resize(evidence,(round(width*scale),round(height*scale)))
        cv2.imwrite(str(out/f"{track['id']}.jpg"),evidence)
        votes={label:sum(s['confidence'] for s in samples if s['class']==label) for label in LABELS.values()};label=max(votes,key=votes.get)
        results.append({'trackId':track['id'],'scene':track['scene'],'vehicleClass':label,'category':'UNKNOWN','size':'UNKNOWN','drivetrain':'UNKNOWN','washType':'UNKNOWN','washDurationSeconds':None,'firstSeenSeconds':round(track['first'],3),'lastSeenSeconds':round(track['last'],3),'observedSpanSeconds':round(track['last']-track['first'],3),'leftCensored':track['first']<2/actual_fps,'rightCensored':duration-track['last']<2/actual_fps,'confidence':round(sum(s['confidence'] for s in samples)/len(samples),4),'sampleCount':len(samples),'zoneIntervals':intervals,'evidenceFile':f"{track['id']}.jpg",'samples':[{'t':s['t'],'box':[round(v,1) for v in s['box']],'confidence':round(s['confidence'],4)} for s in samples]})
    from zone_events import enrich_report
    report={'schemaVersion':2,'source':'VIDEO_FILE','model':'YOLOX-S COCO / OpenCV DNN','sourceSha256':source_hash,'modelSha256':model_hash,'video':{'durationSeconds':duration,'fps':fps,'width':width,'height':height,'frames':total},'samplingFps':actual_fps,'framesProcessed':frames_processed,'runtimeSeconds':round(time.monotonic()-started,2),'detectedTracks':len(results),'confirmedWashedCount':0,'uniquePhysicalVehicleCount':None,'sceneCuts':cut_times,'config':config,'limitations':['Tracks are observations, not proof of completed washes.','COCO classes do not identify sedan/CUV, size or 4x4 drivetrain.','Appearance time is not full wash duration.','Moving cameras and occlusion can split or merge identities.'],'tracks':results}
    report=enrich_report(report,config)
    if config.get('gate') or config.get('gates'):
        from camera_engine import refine_automation
        report['automation']=refine_automation(video,out,report,config,model);report['schemaVersion']=3
        report['runtimeSeconds']=round(time.monotonic()-started,2)
    (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8');(out/'progress.json').write_text(json.dumps({'progress':100,'framesProcessed':frames_processed,'status':'COMPLETED'}),encoding='utf8');print(json.dumps({'status':'COMPLETED','tracks':len(results),'durationSeconds':duration,'runtimeSeconds':report['runtimeSeconds']}),flush=True)
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--input',required=True);parser.add_argument('--model',default=str(ROOT/'.data/models/yolox_s.onnx'));parser.add_argument('--output',required=True);parser.add_argument('--config');args=parser.parse_args()
    try:analyze(Path(args.input),Path(args.model),Path(args.output),json.loads(Path(args.config).read_text(encoding='utf8')) if args.config else {})
    except Exception as error:print(json.dumps({'status':'FAILED','error':str(error) if isinstance(error,ValueError) else type(error).__name__}),flush=True);sys.exit(1)
