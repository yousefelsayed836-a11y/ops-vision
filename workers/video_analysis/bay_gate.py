"""Reusable calibrated bay-gate state machine, independent of video files and track IDs."""
class BayGateEngine:
    def __init__(self,gate):
        self.gate=gate;self.outside=None;self.entering=[];self.exiting=[];self.active=None;self.previous=None;self.events=[];self.cycles=[]
    def update(self,observation):
        t=observation['t'];g=self.gate
        if self.previous is not None and t<self.previous:raise ValueError('NON_MONOTONIC_CAMERA_TIME')
        self.previous=t
        candidates=[d for d in observation['detections'] if g['xMin']<=(d['box'][0]+d['box'][2])/2<=g['xMax'] and d['confidence']>=g.get('confidence',.2)]
        if not candidates:return []
        d=max(candidates,key=lambda d:(d['box'][2]-d['box'][0])*(d['box'][3]-d['box'][1]));front=d['box'][3];sample={'t':t,'front':front,'confidence':d['confidence']};new=[]
        if self.active is None:
            if front<=g['exitY']:self.outside=sample;self.entering=[]
            elif front>=g['entryY']:
                if self.entering and t-self.entering[-1]['t']>g.get('maxConfirmationGapSeconds',2.5):self.entering=[]
                self.entering.append(sample)
                if len(self.entering)>=g.get('confirmations',2):
                    first=self.entering[0];entry=first['t'] if self.outside is not None and first['t']-self.outside['t']<=g.get('maxCrossingGapSeconds',3) else None
                    self.active={'entrySeconds':entry,'entryBracketSeconds':[self.outside['t'],entry] if entry is not None else None,'lastObservedSeconds':t,'evidenceSamples':len(self.entering),'maxDetectionGapSeconds':0,'minimumConfidence':min(s['confidence'] for s in self.entering)}
                    if entry is not None:new.append({'type':'vehicle.entered_bay','videoSeconds':entry,'confirmedAtSeconds':t,'evidence':'OBSERVED_FRONT_GATE_CROSSING','confidence':min(s['confidence'] for s in self.entering)})
                    self.entering=[];self.outside=None;self.last_above_gate=t
            else:self.entering=[]
        else:
            self.active['maxDetectionGapSeconds']=max(self.active['maxDetectionGapSeconds'],t-self.active['lastObservedSeconds']);self.active['lastObservedSeconds']=t;self.active['evidenceSamples']+=1;self.active['minimumConfidence']=min(self.active['minimumConfidence'],d['confidence'])
            if front<=g['exitY']:
                if self.exiting and t-self.exiting[-1]['t']>g.get('maxConfirmationGapSeconds',2.5):self.exiting=[]
                self.exiting.append(sample)
                if len(self.exiting)>=g.get('confirmations',2):
                    exit_time=self.exiting[0]['t'];cycle={**self.active,'exitSeconds':exit_time,'exitBracketSeconds':[self.last_above_gate,exit_time],'complete':self.active['entrySeconds'] is not None,'bayOccupancySeconds':round(exit_time-self.active['entrySeconds'],3) if self.active['entrySeconds'] is not None else None,'activeWashingSeconds':None}
                    self.cycles.append(cycle);new.append({'type':'vehicle.exited_bay','videoSeconds':exit_time,'confirmedAtSeconds':t,'evidence':'OBSERVED_FRONT_GATE_CROSSING','confidence':min(s['confidence'] for s in self.exiting)});self.active=None;self.outside=sample;self.exiting=[]
            else:self.exiting=[];self.last_above_gate=t
        if self.active is not None and not hasattr(self,'last_above_gate'):self.last_above_gate=t
        self.events+=new;return new
    def result(self):return {'engine':'BAY_GATE_V1','events':self.events,'cycles':self.cycles,'activeEpisode':self.active,'completedBayVisits':sum(c['complete'] for c in self.cycles),'automaticPayments':False,'washType':'UNKNOWN','vehicleFineCategory':'UNKNOWN'}

def evaluate_gate(observations,gate):
    engine=BayGateEngine(gate)
    for observation in sorted(observations,key=lambda s:s['t']):engine.update(observation)
    return engine.result()
