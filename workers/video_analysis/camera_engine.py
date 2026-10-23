"""Coarse-to-fine gate processing shared by recorded replay and future camera ingestion."""
from bay_gate import evaluate_gate

def candidate_windows(report,gate,max_seconds=65):
 duration=report['video']['durationSeconds'];edge=min(12,duration/2);windows=[(0,edge),(max(0,duration-edge),max(0,duration-.1))];samples=[];w=report['video']['width'];h=report['video']['height']
 for track in report['tracks']:
  for sample in track['samples']:
   b=sample['box']
   if gate['xMin']<=(b[0]+b[2])/2/w<=gate['xMax']:samples.append((sample['t'],b[3]/h))
 samples=sorted(set(samples))
 if samples:windows.append((max(0,samples[0][0]-12),min(duration-.1,samples[0][0]+12)))
 step=1/report['samplingFps']
 for a,b in zip(samples,samples[1:]):
  if b[0]-a[0]>1.8*step or abs(b[1]-a[1])>.15:
   start=max(0,a[0]-2);end=min(duration-.1,b[0]+2)
   if sum(e-s for s,e in windows)+end-start<=max_seconds:windows.append((start,end))
 merged=[]
 for start,end in sorted(windows):
  if end<=start:continue
  if merged and start<=merged[-1][1]:merged[-1]=(merged[-1][0],max(merged[-1][1],end))
  else:merged.append((start,end))
 return merged

def evaluate_observations(report,refined,gate):
 w=report['video']['width'];h=report['video']['height'];rows={}
 for track in report['tracks']:
  for sample in track['samples']:
   rows.setdefault(sample['t'],[]).append({'box':[v/(w if i%2==0 else h) for i,v in enumerate(sample['box'])],'confidence':sample['confidence'],'class':track['vehicleClass']})
 for row in refined:rows.setdefault(row['t'],[]).extend(row['detections'])
 return evaluate_gate([{'t':t,'detections':d} for t,d in sorted(rows.items())],gate)

def refine_automation(video,out,report,config,model=None):
 from refine_gate import refine
 from vehicle_classifier import classify_cycles
 mappings=config.get('gates') or [{'bayId':config.get('bayId'),'gate':config['gate']}]
 combined={'engine':'MULTI_BAY_GATE_V2','events':[],'cycles':[],'completedBayVisits':0,'activeEpisodes':[],'calibrationVersion':config.get('calibrationVersion',1),'bays':[]}
 for mapping in mappings:
  gate=mapping['gate'];bay=mapping.get('bayId');windows=candidate_windows(report,gate)
  refined=refine(video,out/'gate-refinement'/str(bay or 'default'),windows,fps=2,rotation=config.get('rotation',0),model=model)
  result=evaluate_observations(report,refined,gate);result['refinementWindows']=windows;result['refinedSamples']=len(refined)
  if result.get('activeEpisode'):
   active=result['activeEpisode'];result['cycles'].append({**active,'exitSeconds':None,'bayOccupancySeconds':None,'complete':False})
  local={**report,'config':{**report.get('config',{}),'gate':gate}}
  classify_cycles(video,local,result,config.get('rotation',0))
  for event in result['events']:event['bayId']=bay
  for cycle in result['cycles']:cycle['bayId']=bay
  combined['events']+=result['events'];combined['cycles']+=result['cycles'];combined['completedBayVisits']+=result['completedBayVisits'];combined['bays'].append({'bayId':bay,'refinementWindows':windows,'refinedSamples':len(refined)})
  if result.get('activeEpisode'):combined['activeEpisodes'].append({**result['activeEpisode'],'bayId':bay})
 combined['events'].sort(key=lambda e:e['videoSeconds']);return combined
