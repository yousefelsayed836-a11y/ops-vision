import unittest,json
from pathlib import Path
from bay_gate import evaluate_gate
from camera_engine import candidate_windows

def row(t,front,x=.6):return {'t':t,'detections':[] if front is None else [{'box':[x-.05,0,x+.05,front],'confidence':.8}]}
gate={'xMin':.39,'xMax':.77,'entryY':.4,'exitY':.28,'confirmations':2}
class GateTests(unittest.TestCase):
 def test_real_supplied_clip_catches_entry_exit_and_ignores_repositioning(self):
  case=json.loads((Path(__file__).parent/'fixtures/gate-regression.json').read_text());result=evaluate_gate(case['observations'],case['gate']);ref=case['humanReference'];self.assertEqual(result['completedBayVisits'],1);self.assertEqual([e['type'] for e in result['events']],['vehicle.entered_bay','vehicle.exited_bay'])
  entry,exit=result['events'];self.assertLessEqual(ref['entryRangeSeconds'][0],entry['videoSeconds']);self.assertLessEqual(entry['videoSeconds'],ref['entryRangeSeconds'][1]);self.assertLessEqual(ref['exitRangeSeconds'][0],exit['videoSeconds']);self.assertLessEqual(exit['videoSeconds'],ref['exitRangeSeconds'][1]);self.assertFalse(any(33<=e['videoSeconds']<=45 for e in result['events']));self.assertAlmostEqual(result['cycles'][0]['bayOccupancySeconds'],957.533,places=3)
 def test_automatic_refinement_finds_both_edges_and_positioning_from_coarse_input(self):
  case=json.loads((Path(__file__).parent/'fixtures/gate-regression.json').read_text());windows=candidate_windows(case['coarseReport'],case['gate'])
  for moment in [5.5,37,963.05]:self.assertTrue(any(start<=moment<=end for start,end in windows))
  self.assertLessEqual(sum(end-start for start,end in windows),65)
 def test_missing_detection_never_ends_a_cycle(self):
  r=evaluate_gate([row(0,.1),row(1,.5),row(2,.7),row(5,None),row(8,None)],gate);self.assertEqual(len(r['events']),1);self.assertEqual(r['completedBayVisits'],0)
 def test_already_parked_vehicle_has_no_invented_entry(self):
  r=evaluate_gate([row(0,.7),row(1,.7),row(2,.2),row(3,.1)],gate);self.assertEqual([e['type'] for e in r['events']],['vehicle.exited_bay']);self.assertEqual(r['completedBayVisits'],0)
 def test_neighboring_bay_cannot_trigger_this_gate(self):self.assertEqual(evaluate_gate([row(0,.1,.9),row(1,.7,.9),row(2,.8,.9)],gate)['events'],[])
 def test_flicker_and_position_adjustment_do_not_end_visit(self):
  r=evaluate_gate([row(0,.1),row(1,.5),row(2,.7),row(3,.33),row(4,.32),row(5,.7),row(6,.2),row(7,.15)],gate);self.assertEqual(r['completedBayVisits'],1);self.assertEqual(r['events'][1]['videoSeconds'],6)
 def test_widely_separated_samples_are_not_stable_crossings(self):self.assertEqual(evaluate_gate([row(0,.1),row(50,.7),row(100,.7)],gate)['events'],[])
 def test_refinement_always_includes_clip_edges(self):
  r={'video':{'durationSeconds':966,'width':100,'height':100},'samplingFps':.2,'tracks':[]};windows=candidate_windows(r,gate);self.assertEqual(windows[0][0],0);self.assertGreater(windows[-1][1],965)
if __name__=='__main__':unittest.main()
