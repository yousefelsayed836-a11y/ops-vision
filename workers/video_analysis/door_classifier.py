"""Operator-defined door rule. An inferred wash package is never proof of completion."""
import numpy as np
PROMPTS={
 'OPEN':['a surveillance photo of a car with its doors swung open','an overhead view of a vehicle with an open side door','a car at a car wash with its doors open for interior cleaning'],
 'CLOSED':['a surveillance photo of a car with all doors shut','an overhead view of a vehicle with closed side doors','a car at a car wash with its doors closed'],
 'OBSCURED':['a car hidden by people and foam with unclear doors','an obstructed blurry vehicle with no visible side doors','a car whose doors are outside the camera frame']}

def infer_wash_type(samples,complete,visibility_complete):
 opened=[s for s in samples if s['state']=='OPEN'];closed=[s for s in samples if s['state']=='CLOSED']
 if len(opened)>=2 and opened[-1]['t']-opened[0]['t']>=1:kind='FULL'
 elif complete and visibility_complete and len(samples)>=12 and len(closed)>=len(samples)*.8 and not opened:kind='EXTERIOR'
 else:kind='UNKNOWN'
 return {'washType':kind,'source':'DOOR_RULE_ESTIMATE' if kind!='UNKNOWN' else 'UNRESOLVED','rule':'DOOR_OPEN_V1','openSamples':len(opened),'closedSamples':len(closed),'totalSamples':len(samples),'completeVisit':complete,'bothSidesVisible':visibility_complete,'requiresReview':True,'states':samples,'notCompletionEvidence':True}

class DoorClassifier:
 def __init__(self,vehicle_classifier):
  self.model=vehicle_classifier;prompts=[p for values in PROMPTS.values() for p in values];enc=self.model.tokenizer.encode_batch(prompts);inputs={'input_ids':np.array([e.ids for e in enc],dtype=np.int64),'attention_mask':np.array([e.attention_mask for e in enc],dtype=np.int64)}
  text=self.model.text;vectors=text.run(None,{i.name:inputs[i.name] for i in text.get_inputs()})[0];vectors/=np.linalg.norm(vectors,axis=-1,keepdims=True);self.prototypes=[]
  for start in range(0,len(prompts),3):
   vector=vectors[start:start+3].mean(axis=0);self.prototypes.append(vector/np.linalg.norm(vector))
 def observe(self,crop,t):
  scores=self.model.image_vector(crop)@np.array(self.prototypes).T;order=np.argsort(scores)[::-1];index=int(order[0]);score=float(scores[index]);margin=score-float(scores[order[1]]);state=list(PROMPTS)[index]
  if score<.22 or margin<.015 or state=='OBSCURED':state='UNKNOWN'
  return {'t':t,'state':state,'similarity':round(score,5),'margin':round(margin,5)}
