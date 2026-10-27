# Regenerates src/data/bambu-colors.json from the Bambu Lab store swatches.
# Run from the repo root: python3 scripts/build-bambu-colors.py (needs Pillow + curl).
import re, json, sys, io, urllib.request, subprocess
from PIL import Image
LINES = {
 "pla-basic-filament":"PLA Basic","pla-matte":"PLA Matte","pla-silk-upgrade":"PLA Silk","pla-translucent":"PLA Translucent",
 "pla-tough-upgrade":"PLA Tough","pla-pure":"PLA Pure","petg-basic":"PETG Basic","petg-translucent":"PETG Translucent","petg-matte":"PETG Matte",
}
def get(url):
    return subprocess.run(["curl","-sS","-m","40","-A","Mozilla/5.0",url],capture_output=True).stdout
out=[]
for handle,material in LINES.items():
    html=get(f"https://us.store.bambulab.com/products/{handle}").decode("utf8","ignore").replace('\\"','"')
    pairs=re.findall(r'<li value="([^"]+?) ?\((\d{5})\)"[^>]*><img src="([^"]+)"',html)
    seen=set()
    for name,code,img in pairs:
        if code in seen: continue
        seen.add(code)
        try:
            im=Image.open(io.BytesIO(get(img))).convert("RGB")
        except Exception as e:
            print("skip",material,name,code,e,file=sys.stderr); continue
        w,h=im.size
        c=im.crop((w//4,h//4,3*w//4,3*h//4)).resize((1,1),Image.BOX).getpixel((0,0))
        out.append({"code":code,"material":material,"name":name,"hex":"#%02x%02x%02x"%c})
    print(material,len(seen),file=sys.stderr)
json.dump(out,open("src/data/bambu-colors.json","w"),ensure_ascii=False,indent=0)
print(len(out))
