#!/usr/bin/env python3
"""Export browser and home-screen icons from the generated PJUTS master.

Run: python3 scripts/build-icons.py
Requires Pillow. Artwork is in assets/pjuts-favicon-master.png; this script
only resizes and encodes it. See docs/favicon-design.md for the design prompt.
"""

import hashlib
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/pjuts-favicon-master.png'


def main():
    with Image.open(SOURCE) as image:
        if image.width != image.height or image.width < 512:
            raise ValueError('The master must be square and at least 512 pixels')
        if image.mode == 'RGBA' and image.getchannel('A').getextrema() != (255, 255):
            raise ValueError('The full-bleed master must be opaque for iOS and maskable icons')
        master = image.convert('RGB')

    outputs = {
        'favicon.png': 32,
        'apple-touch-icon.png': 180,
        'assets/icon-192.png': 192,
        'assets/icon-512.png': 512,
        # Essential artwork is already within the maskable icon safe circle.
        'assets/icon-maskable-512.png': 512,
    }
    for name, size in outputs.items():
        master.resize((size, size), Image.Resampling.LANCZOS).save(ROOT / name, optimize=True)
        print(f'{name}: {size} x {size}')

    master.resize((64, 64), Image.Resampling.LANCZOS).save(
        ROOT / 'favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print('favicon.ico: 16, 32, 48, 64 pixels')

    # Icon caches may retain a root filename across query-string changes.
    # Content-based filenames provide a new URL whenever the actual icon changes;
    # keep the conventional root files for clients that discover icons themselves.
    urls = {}
    for name in ('favicon.ico', 'favicon.png', 'apple-touch-icon.png'):
        data = (ROOT / name).read_bytes()
        version = hashlib.sha256(data).hexdigest()[:12]
        asset = Path('assets') / f'pjuts-{Path(name).stem}-{version}{Path(name).suffix}'
        (ROOT / asset).write_bytes(data)
        urls[name] = './' + asset.as_posix()

    index = ROOT / 'index.html'
    lines = index.read_text().splitlines(keepends=True)
    for i, line in enumerate(lines):
        name = None
        if '<link rel="icon"' in line:
            name = 'favicon.png' if 'image/png' in line else 'favicon.ico'
        elif '<link rel="apple-touch-icon"' in line:
            name = 'apple-touch-icon.png'
        if name:
            lines[i] = re.sub(r'href="[^"]+"', f'href="{urls[name]}"', line)
    index.write_text(''.join(lines))
    print('Updated favicon links to content-based asset filenames')


if __name__ == '__main__':
    main()
