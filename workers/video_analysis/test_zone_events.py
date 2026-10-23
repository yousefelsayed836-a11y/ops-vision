import unittest
from zone_events import zone_visits,enrich_report
zone={'x':10,'y':10,'width':50,'height':50}
def samples(values):return [{'t':i,'box':([20,20,30,30] if inside else [80,80,90,90])} for i,inside in enumerate(values)]
class ZoneTests(unittest.TestCase):
 def test_entry_and_exit_require_stable_crossings(self):
  v=zone_visits(samples([False,False,True,True,True,False,False]),zone,1)[0]
  self.assertEqual(v['entrySeconds'],2);self.assertEqual(v['exitSeconds'],5);self.assertEqual(v['durationSeconds'],3);self.assertTrue(v['completePassage'])
 def test_present_at_start_is_not_an_entry(self):
  v=zone_visits(samples([True,True,True,False,False]),zone,1)[0];self.assertIsNone(v['entrySeconds']);self.assertEqual(v['exitSeconds'],3);self.assertIsNone(v['durationSeconds'])
 def test_disappearance_does_not_fabricate_exit(self):
  v=zone_visits(samples([False,False,True,True,True]),zone,1)[0];self.assertIsNone(v['exitSeconds']);self.assertFalse(v['completePassage'])
 def test_one_frame_jitter_does_not_create_a_visit(self):self.assertEqual(zone_visits(samples([False,False,True,False,False]),zone,1),[])
 def test_single_false_outside_does_not_end_visit(self):
  v=zone_visits(samples([False,False,True,True,False,True,True]),zone,1)[0];self.assertIsNone(v['exitSeconds'])
 def test_detection_gap_is_not_exit_or_reentry(self):
  s=samples([False,False,True,True]);s+= [{'t':20,'box':[20,20,30,30]},{'t':21,'box':[20,20,30,30]}]
  v=zone_visits(s,zone,1);self.assertEqual(len(v),2);self.assertIsNone(v[0]['exitSeconds']);self.assertIsNone(v[1]['entrySeconds'])
 def test_no_calibration_means_no_zone_events(self):self.assertEqual(zone_visits(samples([True]*5),None,1),[])
if __name__=='__main__':unittest.main()
