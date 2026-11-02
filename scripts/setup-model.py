"""Download only the pinned, public inference files. No credentials or user prompts."""
from pathlib import Path
import urllib.request, hashlib, json, os

ROOT=Path(__file__).resolve().parents[1]
REPO='Xenova/paraphrase-multilingual-MiniLM-L12-v2'
REVISION='2c4055b12046f11709e9df2c122e59ffbdc2f900'
FILES=['config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json','onnx/model_quantized.onnx']
destination=ROOT/'models'/REPO
records=[]
for name in FILES:
    target=destination/name;target.parent.mkdir(parents=True,exist_ok=True)
    if not target.exists():
        print('Downloading',name,flush=True)
        temporary=target.with_suffix(target.suffix+'.part')
        with urllib.request.urlopen(f'https://huggingface.co/{REPO}/resolve/{REVISION}/{name}',timeout=60) as response,temporary.open('wb') as output:
            while True:
                block=response.read(1024*1024)
                if not block:break
                output.write(block)
        temporary.replace(target)
    records.append(dict(path=name,bytes=target.stat().st_size,sha256=hashlib.sha256(target.read_bytes()).hexdigest()))
    print(name,target.stat().st_size,'bytes',flush=True)
(ROOT/'models/manifest.json').write_text(json.dumps(dict(model=REPO,revision=REVISION,files=records),indent=2),encoding='utf8')
print('Model ready; local inference can run without network.',flush=True)
