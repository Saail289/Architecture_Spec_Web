"""Installs the images picked in generated/compare.html into the site.

    python scripts/install-picks.py

Reads generated/selections.json + generated/manifest.json and writes each pick, normalised to the
site's 1376x768 JPEG, to uploads/images/projects/<slug>.jpeg (card) or
uploads/images/interiors/<slug>/<room>.jpeg. 'current' leaves the live file alone; 'redo' is skipped.

Marina's walkthrough keyframes are also copied, at the picked image's native size and in shot order,
to uploads/video/hubtown-marina/frames/.
"""
import json
import os
from PIL import Image, ImageOps

SIZE = (1376, 768)  # matches the existing site renders
VIDEO_SHOTS = ['00-aerial', 'card', '01-forecourt', 'reception', 'lobby', 'workspace', 'boardroom', 'cafe', 'terrace']

picks = json.load(open('generated/selections.json'))['picks']
results = json.load(open('generated/manifest.json'))['results']
path_of = {(r['slug'], r['file'], r['model']): r['path'] for r in results}


def site_path(slug, file):
    if file == 'card':
        return f'uploads/images/projects/{slug}.jpeg'
    if file[:2].isdigit():
        return None  # video-only keyframe
    return f'uploads/images/interiors/{slug}/{file}.jpeg'


installed = 0
for key, pick in sorted(picks.items()):
    slug, file = key.split('/')
    choice = pick.get('choice')
    if choice not in ('recraft-v4.1', 'nano-banana-2.1'):
        print(f'skip  {key:34} ({choice})')
        continue
    dest = site_path(slug, file)
    if not dest:
        continue
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    img = Image.open(path_of[(slug, file, choice)]).convert('RGB')
    ImageOps.fit(img, SIZE, Image.LANCZOS).save(dest, 'JPEG', quality=86, optimize=True, progressive=True)
    installed += 1
    print(f'ok    {key:34} <- {choice}')

frames = 'uploads/video/hubtown-marina/frames'
os.makedirs(frames, exist_ok=True)
for n, file in enumerate(VIDEO_SHOTS, 1):
    pick = picks.get(f'hubtown-marina/{file}', {})
    choice = pick.get('choice')
    if choice not in ('recraft-v4.1', 'nano-banana-2.1'):
        print(f'MISSING video frame {file}')
        continue
    name = 'exterior' if file == 'card' else file.split('-', 1)[-1]
    Image.open(path_of[('hubtown-marina', file, choice)]).convert('RGB').save(
        f'{frames}/{n:02d}-{name}.jpeg', 'JPEG', quality=92)
print(f'\n{installed} site images installed; video frames in {frames}/')
