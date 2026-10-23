"""Inference caches must invalidate when weights or source bytes change, even at equal size."""
import hashlib,json

def file_digest(path):
 digest=hashlib.sha256()
 with path.open('rb') as source:
  for chunk in iter(lambda:source.read(1024*1024),b''):digest.update(chunk)
 return digest.hexdigest()

def inference_identity(video,model,config):
 source_hash=file_digest(video);model_hash=file_digest(model)
 identity=hashlib.sha256(json.dumps({'source':source_hash,'model':model_hash,'config':config},sort_keys=True).encode()).hexdigest()
 return identity,source_hash,model_hash
