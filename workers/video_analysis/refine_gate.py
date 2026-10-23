"""Dense vehicle detection around candidate gate crossings, reused by the camera engine."""
import sys,json,hashlib,math
from pathlib import Path
from analyze import Detector,cv2

def refine(video,output,windows,fps=2,rotation=270,model=None):
 from video_cache import inference_identity
 model=model or Path(__file__).resolve().parents[2]/'.data/models/yolox_s.onnx'
 output.mkdir(parents=True,exist_ok=True);cache_path=output/'gate-detections.json';identity=inference_identity(video,model,{'rotation':rotation,'fps':fps,'detector':'gate-v1'})[0];identity_path=output/'gate-cache-identity.txt'
 if identity_path.exists() and identity_path.read_text()==identity:cached=json.loads(cache_path.read_text()) if cache_path.exists() else {}
 else:cached={};identity_path.write_text(identity)
 cap=cv2.VideoCapture(str(video));detector=Detector(model);rows=[]
 times=sorted({round(i/fps,3) for start,end in windows for i in range(math.ceil(start*fps),math.floor(end*fps)+1)})
 for i,t in enumerate(times):
  key=str(t)
  if key in cached:row=cached[key]
  else:
   cap.set(cv2.CAP_PROP_POS_MSEC,t*1000);ok,frame=cap.read()
   if not ok:continue
   frame=cv2.rotate(frame,{90:cv2.ROTATE_90_CLOCKWISE,180:cv2.ROTATE_180,270:cv2.ROTATE_90_COUNTERCLOCKWISE}[rotation]) if rotation else frame;h,w=frame.shape[:2];detections=detector.detect(frame,.20,.002)
   row={'t':round(cap.get(cv2.CAP_PROP_POS_MSEC)/1000,3),'requestedTime':t,'detections':[{'box':[round(b/w if j%2==0 else b/h,5) for j,b in enumerate(d['box'])],'confidence':round(d['confidence'],4),'class':d['class']} for d in detections]};cached[key]=row;cache_path.write_text(json.dumps(cached),encoding='utf8')
  rows.append(row)
  if i%10==0:print(json.dumps({'refinement':round((i+1)/len(times)*100)}),flush=True)
 cap.release();(output/'gate-observations.json').write_text(json.dumps(rows,indent=2),encoding='utf8');return rows
if __name__=='__main__':
 refine(Path(sys.argv[1]),Path(sys.argv[2]),[(3,11),(33,45),(957,965.5)])
