"""Conservative zone observations. Missing detections never prove an exit or a wash."""
from datetime import datetime,timedelta

def zone_visits(samples,zone,sample_fps,anchor='center',minimum_samples=2):
    if not zone:return []
    gap_limit=2.5/sample_fps
    def inside(s):
        x1,y1,x2,y2=s['box'];x=(x1+x2)/2;y=(y1+y2)/2 if anchor=='center' else y2
        return zone['x']<=x<=zone['x']+zone['width'] and zone['y']<=y<=zone['y']+zone['height']
    visits=[];pending=[];outside=[];active=None;previous=None;recent_outside=[]
    def close(exit_time=None,reason=None):
        nonlocal active
        if active:
            active['exitSeconds']=exit_time
            active['endReason']=reason
            active['observedSeconds']=round(active['lastInsideSeconds']-active['firstInsideSeconds'],3)
            active['completePassage']=active['entrySeconds'] is not None and exit_time is not None
            active['durationSeconds']=round(exit_time-active['entrySeconds'],3) if active['completePassage'] else None
            visits.append(active);active=None
    for sample in samples:
        t=sample['t']
        if previous is not None and t-previous>gap_limit:
            close(reason='DETECTION_GAP');pending=[];outside=[];recent_outside=[]
        if inside(sample):
            outside=[]
            if active:active['lastInsideSeconds']=t
            else:
                pending.append(sample)
                if len(pending)>=minimum_samples:
                    entry=pending[0]['t'] if len(recent_outside)>=minimum_samples else None
                    active={'entrySeconds':entry,'firstInsideSeconds':pending[0]['t'],'lastInsideSeconds':t,'entryBracketSeconds':[recent_outside[-1]['t'],entry] if entry is not None else None,'exitBracketSeconds':None,'timingUncertaintySeconds':round(1/sample_fps,3)};pending=[];recent_outside=[]
        else:
            pending=[];recent_outside.append(sample);recent_outside=recent_outside[-minimum_samples:]
            if active:
                outside.append(sample)
                if len(outside)>=minimum_samples:
                    active['exitBracketSeconds']=[active['lastInsideSeconds'],outside[0]['t']]
                    close(outside[0]['t'],'OBSERVED_EXIT');outside=[]
        previous=t
    close(reason='TRACK_END_OR_OCCLUSION')
    return visits

def enrich_report(report,config):
    video=report['video'];zone=config.get('zone');pixel_zone=None
    if zone:pixel_zone={'x':zone['x']*video['width'],'y':zone['y']*video['height'],'width':zone['width']*video['width'],'height':zone['height']*video['height']}
    started=None
    if config.get('recordingStartedAt'):
        started=datetime.fromisoformat(config['recordingStartedAt'].replace('Z','+00:00'))
    totals={'observedEntries':0,'observedExits':0,'completePassages':0,'partialVisits':0}
    for track in report['tracks']:
        visits=zone_visits(track['samples'],pixel_zone,report['samplingFps'],config.get('zoneAnchor','bottom'))
        for visit in visits:
            for kind in ['entry','exit']:
                seconds=visit[kind+'Seconds'];visit[kind+'At']=(started+timedelta(seconds=seconds)).isoformat() if started and seconds is not None else None
            totals['observedEntries']+=int(visit['entrySeconds'] is not None);totals['observedExits']+=int(visit['exitSeconds'] is not None)
            totals['completePassages']+=int(visit['completePassage']);totals['partialVisits']+=int(not visit['completePassage'])
        track['visits']=visits
        track['categorySource']='COCO_BROAD_CLASS_ONLY';track['washTypeSource']='NOT_INFERRED'
        track['reviewRequired']=True;track['reviewReasons']=['FINE_CATEGORY_UNAVAILABLE','WASH_SERVICE_UNAVAILABLE']+(['INCOMPLETE_ZONE_PASSAGE'] if any(not v['completePassage'] for v in visits) else [])
    report['zoneSummary']=totals;report['zoneConfigured']=bool(zone);report['timingReference']='RECORDING_START_PROVIDED' if started else 'VIDEO_OFFSET_ONLY'
    report['operationalWrites']=False
    report['limitations']+=['Entry/exit requires stable observed zone crossings; disappearance is not exit.','Zone dwell is not washing duration; partial visits have no complete duration.','Screen recording overlays, scrubbing and camera-clock jumps can invalidate timing.']
    return report
