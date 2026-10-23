import unittest,tempfile
from pathlib import Path
from video_cache import inference_identity
TEMP=Path(__file__).resolve().parents[2]/'.data/tmp-vision'
TEMP.mkdir(parents=True,exist_ok=True)
class CacheTests(unittest.TestCase):
 def test_equal_size_new_weights_invalidate_inference(self):
  with tempfile.TemporaryDirectory(dir=TEMP) as folder:
   video=Path(folder)/'video';model=Path(folder)/'model';video.write_bytes(b'video');model.write_bytes(b'AAAA');before=inference_identity(video,model,{'fps':1})[0];model.write_bytes(b'BBBB');self.assertNotEqual(before,inference_identity(video,model,{'fps':1})[0])
 def test_source_bytes_and_config_are_bound_to_cache(self):
  with tempfile.TemporaryDirectory(dir=TEMP) as folder:
   video=Path(folder)/'video';model=Path(folder)/'model';video.write_bytes(b'AAAA');model.write_bytes(b'model');before=inference_identity(video,model,{'fps':1})[0];self.assertNotEqual(before,inference_identity(video,model,{'fps':2})[0]);video.write_bytes(b'BBBB');self.assertNotEqual(before,inference_identity(video,model,{'fps':1})[0])
if __name__=='__main__':unittest.main()
