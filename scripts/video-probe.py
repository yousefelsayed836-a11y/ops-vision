import sys, json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'.data/python'))
import cv2
from PIL import Image, ImageDraw
video=Path(sys.argv[1]); target=Path(sys.argv[2]);target.mkdir(parents=True,exist_ok=True)
cap=cv2.VideoCapture(str(video))
if not cap.isOpened():raise RuntimeError('Video cannot be decoded')
fps=cap.get(cv2.CAP_PROP_FPS);frames=int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
width=int(cap.get(cv2.CAP_PROP_FRAME_WIDTH));height=int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
info={'fps':fps,'frames':frames,'width':width,'height':height,'durationSeconds':frames/fps if fps else None}
(target/'metadata.json').write_text(json.dumps(info,indent=2),encoding='utf8')
sheet=Image.new('RGB',(1280,4*210),'#ffffff');draw=ImageDraw.Draw(sheet)
for i in range(16):
    frame_no=int(i*(frames-1)/15);cap.set(cv2.CAP_PROP_POS_FRAMES,frame_no);ok,frame=cap.read()
    if not ok:continue
    img=Image.fromarray(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB));img.thumbnail((320,180))
    x=(i%4)*320;y=(i//4)*210;sheet.paste(img,(x,y));draw.text((x+5,y+182),f'{frame_no/fps:.2f}s',fill='black')
sheet.save(target/'contact-sheet.jpg');cap.release();print(json.dumps(info))
