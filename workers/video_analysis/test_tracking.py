import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from analyze import Tracker,overlap,np

def detection(box):return {'box':box,'confidence':.8,'class':'CAR'}
class TrackingTests(unittest.TestCase):
 def test_same_vehicle_stays_in_one_track(self):
  tracker=Tracker(1000,1000);tracker.update([detection([10,10,110,110])],0);tracker.update([detection([20,10,120,110])],.25)
  self.assertEqual(len(tracker.tracks),1);self.assertEqual(len(tracker.tracks[0]['samples']),2)
 def test_long_occlusion_does_not_assume_same_identity(self):
  tracker=Tracker(1000,1000);tracker.update([detection([10,10,110,110])],0);tracker.update([detection([10,10,110,110])],3)
  self.assertEqual(len(tracker.tracks),2)
 def test_scene_cut_does_not_reuse_identity(self):
  tracker=Tracker(1000,1000);tracker.update([detection([10,10,110,110])],0,0);tracker.update([detection([10,10,110,110])],.25,1)
  self.assertEqual(len(tracker.tracks),2)
 def test_one_detection_cannot_attach_to_two_tracks(self):
  tracker=Tracker(1000,1000);tracker.update([detection([10,10,110,110]),detection([80,10,180,110])],0);tracker.update([detection([60,10,160,110])],.25)
  self.assertEqual(sum(len(t['samples']) for t in tracker.tracks),3)
 def test_nonoverlapping_boxes(self):self.assertEqual(overlap([0,0,10,10],[20,20,30,30]),0)
 def test_overlap_survives_color_change_under_spray(self):
  tracker=Tracker(1000,1000);a=detection([100,100,300,300]);b=detection([120,100,320,300]);a['appearance']=np.array([[1.,0.]],dtype=np.float32);b['appearance']=np.array([[0.,1.]],dtype=np.float32)
  tracker.update([a],0);tracker.update([b],.25);self.assertEqual(len(tracker.tracks),1)
if __name__=='__main__':unittest.main()
