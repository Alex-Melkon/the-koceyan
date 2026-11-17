#!/usr/bin/env python3
"""Copy every image and video the site uses off Wix into media/, and point index.html at the copies.
Run from the site folder:  python3 -I tools/fetch-media.py
Each image is saved as WebP at up to three widths (800 / 1400 / 2000). Wix never upscales, so a small original
simply has fewer sizes. MEDIA_W (written into index.html) lists the widths that exist for each file."""
import hashlib, io, json, os, re, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA_DIR = os.path.join(SITE, "media")
WIX = "https://static.wixstatic.com/media/32c9e4_"
LADDER = [800, 1400, 2000]
UA = {"Accept": "image/webp,image/*,*/*;q=0.8", "User-Agent": "Mozilla/5.0"}

html_path = os.path.join(SITE, "index.html")
html = io.open(html_path, encoding="utf-8").read()
js = io.open(os.path.join(SITE, "game", "museum.js"), encoding="utf-8").read()
if "static.wixstatic.com" not in html:
    sys.exit("index.html no longer points at Wix - nothing to do")
files = sorted(set(re.findall(r"\b([0-9a-f]{32}\.(?:webp|jpg|jpeg|png|gif))\b", html + js)))
print(len(files), "unique image files referenced")
os.makedirs(MEDIA_DIR, exist_ok=True)

def get(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                data = r.read()
                if not data: raise IOError("empty response")
                return data, r.headers.get("Content-Type", "")
        except Exception as e:
            err = e
    raise err

def fetch(file):
    fid, ext = file.split(".")
    base = f"{WIX}{fid}~mv2.{ext}"
    if ext == "gif":
        data, _ = get(base)
        io.open(os.path.join(MEDIA_DIR, fid + ".gif"), "wb").write(data)
        return fid, "gif"
    kept, last = [], None
    for w in LADDER:
        data, ctype = get(f"{base}/v1/fit/w_{w},h_{w*2},q_90,enc_auto/32c9e4_{fid}~mv2.{ext}")
        if "webp" not in ctype: raise IOError(f"expected webp, got {ctype}")
        h = hashlib.sha1(data).hexdigest()
        if h == last: break                      # the original is no bigger than the previous size
        last = h
        io.open(os.path.join(MEDIA_DIR, f"{fid}-{w}.webp"), "wb").write(data)
        kept.append(w)
    return fid, kept

manifest, errors = {}, []
with ThreadPoolExecutor(max_workers=8) as ex:
    for f, fut in [(f, ex.submit(fetch, f)) for f in files]:
        try:
            fid, info = fut.result(); manifest[fid] = info
        except Exception as e:
            errors.append(f"{f}: {e}")
if errors:
    sys.exit("FAILED, index.html left untouched:\n  " + "\n  ".join(errors))

# videos appear as {video:"id"} and as V("id", w, h)
vids = sorted(set(re.findall(r'video:"([0-9a-f]{32})"', html) + re.findall(r'\bV\("([0-9a-f]{32})"', html)))
for vid in vids:
    try: data, _ = get(f"https://video.wixstatic.com/video/32c9e4_{vid}/1080p/mp4/file.mp4")
    except Exception: data, _ = get(f"https://video.wixstatic.com/video/32c9e4_{vid}/720p/mp4/file.mp4")   # some only exist at 720p
    io.open(os.path.join(MEDIA_DIR, vid + ".mp4"), "wb").write(data)
    data, _ = get(f"{WIX}{vid}f000.jpg")
    io.open(os.path.join(MEDIA_DIR, vid + "-poster.jpg"), "wb").write(data)
print(len(vids), "video(s) + poster saved")

old = re.search(r'const MEDIA = "https://static\.wixstatic\.com/media/32c9e4_";\n.*?^function src\(file, w\)\{\n.*?^\}\n', html, re.S | re.M)
old_vid = ('const VIDEO = id => `https://video.wixstatic.com/video/32c9e4_${id}/720p/mp4/file.mp4`;\n'
           'const POSTER = id => `${MEDIA}${id}f000.jpg`;\n')
old_hd = "const v = it.hd ? `https://video.wixstatic.com/video/32c9e4_${it.video}/1080p/mp4/file.mp4` : VIDEO(it.video);"
if not old or html.count(old_vid) != 1 or html.count(old_hd) != 1:
    sys.exit("index.html did not look as expected - left untouched")
new = '''const MEDIA = "media/";
// Every image lives in media/ (copied off Wix by tools/fetch-media.py). MEDIA_W lists the widths each file was
// saved at; a request is served by the smallest saved size that is at least ~85% of the width asked for.
const MEDIA_W = ''' + json.dumps(manifest, separators=(",", ":")) + ''';
function src(file, w){
  // file = "<id>.<ext>" ; gifs are kept whole so they keep animating
  const [id, ext] = file.split(".");
  const ws = MEDIA_W[id];
  if (ext === "gif" || ws === "gif") return `${MEDIA}${id}.gif`;
  if (!ws) return `${MEDIA}${id}.${ext}`;
  const pick = (w && ws.find(x => x >= w * .85)) || ws[ws.length - 1];
  return `${MEDIA}${id}-${pick}.webp`;
}
'''
html = html[:old.start()] + new + html[old.end():]
html = html.replace(old_vid, 'const VIDEO = id => `${MEDIA}${id}.mp4`;\nconst POSTER = id => `${MEDIA}${id}-poster.jpg`;\n')
html = html.replace(old_hd, "const v = VIDEO(it.video);")
io.open(html_path, "w", encoding="utf-8").write(html)
n = os.listdir(MEDIA_DIR)
print(f"media/: {len(n)} files, {sum(os.path.getsize(os.path.join(MEDIA_DIR, f)) for f in n)/1e6:.1f} MB")
print("wix references left:", re.findall(r"wix[a-z]*\.com", html + js) or "none")
