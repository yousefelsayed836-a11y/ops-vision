"""Install pinned public CLIP ONNX weights locally; no customer media is uploaded."""
from pathlib import Path
import json,urllib.request,hashlib
ROOT=Path(__file__).resolve().parents[1];folder=ROOT/'.data/models/vehicle-clip';folder.mkdir(parents=True,exist_ok=True)
REVISION='4c1807b705b1d015fb032789cc4d221b23025a6f'
files=['onnx/vision_model_quantized.onnx','onnx/text_model_quantized.onnx','tokenizer.json','preprocessor_config.json']
manifest={}
for name in files:
 target=folder/Path(name).name
 if not target.exists():
  partial=target.with_suffix(target.suffix+'.part')
  urllib.request.urlretrieve(f'https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/{REVISION}/{name}',partial)
  partial.rename(target)
 manifest[name]=hashlib.sha256(target.read_bytes()).hexdigest();print(name,target.stat().st_size,flush=True)
(folder/'manifest.json').write_text(json.dumps({'repository':'Xenova/clip-vit-base-patch32','revision':REVISION,'sha256':manifest},indent=2))

references=json.loads((ROOT/'workers/video_analysis/reference-sources.json').read_text(encoding='utf-8'));reference_folder=folder/'references';reference_folder.mkdir(exist_ok=True)
for ref in references:
 target=reference_folder/ref['file']
 if not target.exists():
  request=urllib.request.Request(ref['url'],headers={'User-Agent':'OpsVision local prototype/0.1'})
  with urllib.request.urlopen(request,timeout=120) as response:target.write_bytes(response.read())
 if hashlib.sha256(target.read_bytes()).hexdigest()!=ref['sha256']:raise ValueError('REFERENCE_HASH_MISMATCH')
(reference_folder/'sources.json').write_text(json.dumps(references,indent=2),encoding='utf-8')
