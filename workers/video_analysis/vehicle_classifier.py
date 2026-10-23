"""Three user-defined body-shape classes. Scores are similarities, not calibrated accuracy."""
import sys,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'.data/vision-python'))
import numpy as np
PROMPTS={
 'SEDAN':['a photo of a sedan car with a low roof and a separate trunk','a Toyota Camry or Corolla sedan car','an overhead CCTV view of a sedan saloon car with a separate trunk'],
 'SUV':['a photo of a compact crossover SUV car, such as Hyundai Tucson','a Kia Sportage or Toyota RAV4 crossover SUV','an overhead CCTV view of a compact crossover SUV'],
 'FULL_SIZE_SUV':['a photo of a large boxy off road SUV, such as Toyota Land Cruiser','a Nissan Patrol or Toyota Land Cruiser full size SUV','an overhead CCTV view of a Mercedes G Class G Wagon boxy offroad SUV'],
 'OTHER':['a photo of a pickup truck or a delivery van','a photo of a bus or a motorcycle','an unclear obstructed vehicle covered in foam']}

def decide(similarities,minimum=.22,margin=.025):
 ordered=sorted(similarities.items(),key=lambda row:row[1],reverse=True);best,score=ordered[0];gap=score-ordered[1][1]
 accepted=best!='OTHER' and score>=minimum and gap>=margin
 return {'category':best if accepted else 'UNKNOWN','candidate':best,'similarity':round(float(score),5),'margin':round(float(gap),5),'scores':{k:round(float(v),5) for k,v in similarities.items()},'source':'AI_VISUAL' if accepted else 'UNRESOLVED','requiresReview':True,'meaning':'BODY_SHAPE_NOT_DRIVETRAIN','model':'CLIP-ViT-B32-ONNX','policyVersion':1}

class VehicleClassifier:
 def __init__(self,folder=None):
  import onnxruntime as ort
  from tokenizers import Tokenizer
  from video_cache import file_digest
  folder=folder or ROOT/'.data/models/vehicle-clip';self.folder=folder
  manifest=json.loads((folder/'manifest.json').read_text());self.revision=manifest['revision']
  for name,digest in manifest['sha256'].items():
   if file_digest(folder/Path(name).name)!=digest:raise ValueError('CLASSIFIER_MODEL_HASH_MISMATCH')
  options=ort.SessionOptions();options.intra_op_num_threads=2
  self.vision=ort.InferenceSession(str(folder/'vision_model_quantized.onnx'),sess_options=options,providers=['CPUExecutionProvider'])
  text=ort.InferenceSession(str(folder/'text_model_quantized.onnx'),sess_options=options,providers=['CPUExecutionProvider']);tokenizer=Tokenizer.from_file(str(folder/'tokenizer.json'));tokenizer.enable_padding(length=77,pad_id=49407,pad_token='<|endoftext|>');tokenizer.enable_truncation(max_length=77)
  self.text=text;self.tokenizer=tokenizer
  prompts=[p for values in PROMPTS.values() for p in values];enc=tokenizer.encode_batch(prompts);inputs={'input_ids':np.array([e.ids for e in enc],dtype=np.int64),'attention_mask':np.array([e.attention_mask for e in enc],dtype=np.int64)}
  embeddings=text.run(None,{i.name:inputs[i.name] for i in text.get_inputs()})[0];embeddings/=np.linalg.norm(embeddings,axis=-1,keepdims=True)
  self.prototypes=[]
  for start in range(0,len(prompts),3):
   prototype=embeddings[start:start+3].mean(axis=0);self.prototypes.append(prototype/np.linalg.norm(prototype))
  config=json.loads((folder/'preprocessor_config.json').read_text());self.mean=np.array(config['image_mean'],dtype=np.float32);self.std=np.array(config['image_std'],dtype=np.float32)
  self.references={}
  reference_folder=folder/'references'
  if (reference_folder/'sources.json').exists():
   from analyze import cv2,Detector
   detector=Detector(ROOT/'.data/models/yolox_s.onnx')
   for ref in json.loads((reference_folder/'sources.json').read_text(encoding='utf-8')):
    path=reference_folder/ref['file']
    if ref.get('sha256') and file_digest(path)!=ref['sha256']:raise ValueError('REFERENCE_HASH_MISMATCH')
    frame=cv2.imread(str(path));height,width=frame.shape[:2];detections=detector.detect(frame,.2,.01)
    if not detections:continue
    detection=max(detections,key=lambda d:(d['box'][2]-d['box'][0])*(d['box'][3]-d['box'][1]));x1,y1,x2,y2=map(int,detection['box']);crop=frame[max(0,y1-8):min(height,y2+8),max(0,x1-8):min(width,x2+8)]
    self.references[ref['category']]=self.image_vector(crop)
 def image_vector(self,crop):
  from PIL import Image,ImageOps
  image=Image.fromarray(crop[:,:,::-1]);image=ImageOps.pad(image,(224,224),method=Image.Resampling.BICUBIC,color=(127,127,127))
  pixels=((np.asarray(image,dtype=np.float32)/255-self.mean)/self.std).transpose(2,0,1)[None].astype(np.float32)
  vector=self.vision.run(None,{self.vision.get_inputs()[0].name:pixels})[0][0];return vector/np.linalg.norm(vector)
 def classify(self,crops):
  if not crops:return {'category':'UNKNOWN','source':'UNRESOLVED','requiresReview':True,'reason':'NO_CLEAR_CROP'}
  vectors=np.array([self.image_vector(crop) for crop in crops]);text_scores=vectors@np.array(self.prototypes).T;mean_text=dict(zip(PROMPTS,text_scores.mean(axis=0)))
  result=decide(mean_text)
  if len(self.references)==3:
   refs={key:float((vectors@vector).mean()) for key,vector in self.references.items()}
   combined={key:.8*value+.2*float(mean_text[key]) for key,value in refs.items()};combined['OTHER']=.0
   result=decide(combined,minimum=.4,margin=.025);result['referenceScores']=refs;result['textScores']={key:float(value) for key,value in mean_text.items()};result['referenceCount']=3;result['referenceMode']='ILLUSTRATIVE_PROTOTYPES_NOT_TRAINED_WEIGHTS'
   # Reject even a reference match when frames disagree or text strongly indicates an unrelated object.
   votes=[max(self.references,key=lambda key:float(vector@self.references[key])) for vector in vectors]
   if votes.count(result['category'])<2 or mean_text['OTHER']>max(v for k,v in mean_text.items() if k!='OTHER')+.025:result.update(category='UNKNOWN',source='UNRESOLVED')
   result['frameVotes']=votes
  result['sampleCount']=len(crops);result['revision']=self.revision;return result

def classify_cycles(video,report,automation,rotation):
 from analyze import cv2
 if not (ROOT/'.data/models/vehicle-clip/manifest.json').exists():return
 classifier=VehicleClassifier()
 from door_classifier import DoorClassifier,infer_wash_type
 door_model=DoorClassifier(classifier)
 cap=cv2.VideoCapture(str(video));w=report['video']['width'];h=report['video']['height'];gate=report['config']['gate']
 try:
  for cycle in automation['cycles']:
   if cycle['entrySeconds'] is None:continue
   start=cycle['entrySeconds'];end=cycle['exitSeconds'] if cycle['exitSeconds'] is not None else report['video']['durationSeconds'];samples=[]
   for track in report['tracks']:
    for sample in track['samples']:
     b=sample['box'];t=sample['t']
     if start+2<=t<=end-2 and gate['xMin']<=(b[0]+b[2])/2/w<=gate['xMax']:samples.append(sample)
   # Spread three clear detector crops across the visit, keeping all evidence timestamps.
   samples=sorted(samples,key=lambda s:s['t']);chosen=[samples[round((len(samples)-1)*f)] for f in (.05,.5,.95)] if samples else [];crops=[];times=[]
   for sample in chosen:
    cap.set(cv2.CAP_PROP_POS_MSEC,sample['t']*1000);ok,frame=cap.read()
    if not ok:continue
    if rotation:frame=cv2.rotate(frame,{90:cv2.ROTATE_90_CLOCKWISE,180:cv2.ROTATE_180,270:cv2.ROTATE_90_COUNTERCLOCKWISE}[rotation])
    x1,y1,x2,y2=map(int,sample['box']);pad=8;crop=frame[max(0,y1-pad):min(h,y2+pad),max(0,x1-pad):min(w,x2+pad)]
    if crop.shape[0]<48 or crop.shape[1]<48:continue
    crops.append(crop);times.append(sample['t'])
   cycle['classification']=classifier.classify(crops);cycle['classification']['evidenceSeconds']=times
   door_samples=[];selected=[];last=-100;visibility_complete=True
   for sample in samples:
    if sample['t']-last>=20:selected.append(sample);last=sample['t']
   for sample in selected[:60]:
    cap.set(cv2.CAP_PROP_POS_MSEC,sample['t']*1000);ok,frame=cap.read()
    if not ok:continue
    if rotation:frame=cv2.rotate(frame,{90:cv2.ROTATE_90_CLOCKWISE,180:cv2.ROTATE_180,270:cv2.ROTATE_90_COUNTERCLOCKWISE}[rotation])
    x1,y1,x2,y2=map(int,sample['box']);pad=int((x2-x1)*.5);top=int((y2-y1)*.1)
    if x1-pad<0 or x2+pad>w:visibility_complete=False
    context=frame[max(0,y1-top):min(h,y2+top),max(0,x1-pad):min(w,x2+pad)]
    if context.size:door_samples.append(door_model.observe(context,sample['t']))
   cycle['doorActivity']=infer_wash_type(door_samples,cycle['exitSeconds'] is not None,visibility_complete)
 finally:cap.release()
