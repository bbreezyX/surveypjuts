# PJUTS favicon

The solar-location mark represents the distribution of solar-powered public
lighting survey sites. Its sun disc, open map-pin silhouette and three broad
light accents are designed to stay recognizable at browser-tab sizes. The
navy and yellow palette follows the existing map's visual language.

Created with the built-in ImageGen tool on 7 September 2026. The selected
generated artwork is preserved in `assets/pjuts-favicon-master.png`. The export
script only resizes and encodes it; it does not redraw or retouch the artwork.

Run `python3 scripts/build-icons.py` with Pillow installed to regenerate:

- `favicon.png`: 32 px browser icon.
- `favicon.ico`: 16, 32, 48 and 64 px variants.
- `apple-touch-icon.png`: opaque 180 px iOS icon.
- `assets/icon-192.png` and `assets/icon-512.png`: manifest icons.
- `assets/icon-maskable-512.png`: opaque Android maskable icon. The core mark
  fits inside the central 80%-diameter safe circle.

The builder also writes content-addressed copies of the ICO, 32 px PNG and
Apple touch icon under `assets/pjuts-…` and updates their links in `index.html`.
This changes the actual asset URL when the artwork changes, instead of relying
only on a query-string version to invalidate browser icon caches. Conventional
root filenames remain available for automatic favicon discovery.

## Generation prompt

Use case: logo-brand. Create ONE final production favicon / app icon for a premium Indonesian public infrastructure map called Sebaran PJUTS (distribution of solar-powered street lighting survey sites in Jambi). Not a presentation, not a logo sheet, not a mockup. A single square 1024x1024 image. Full-bleed completely opaque deep midnight navy background (#152D43), edge to edge, no border, no exterior padding. At the center, an exceptionally refined bold geometric icon fusing a MAP LOCATION MARKER and the SUN / SOLAR LIGHT. Core idea: a strong sculpted golden map-marker silhouette whose circular head houses a distinct solar disc separated by generous navy negative space, with an intelligently interrupted upper arc suggesting emitted light. Reduce the entire logo to just a few broad, exceptionally balanced, precise geometric forms. It should feel like a serious identity studio's ownable civic energy symbol, not a stock map pin with a tiny sun pasted inside. One confident golden yellow (#FEE50F) for the mark; navy background. Flat two-color vector-like artwork only, immaculate clean edges, no gradients, no metallic effects, no texture, no shadows, no 3D, no rays with hairlines, no text, no letters, no numerals, no decorative orbit/network, no real government crest. The image itself is the icon tile, straight-on, no surrounding scene. Center all essential yellow artwork within a circle of radius 37% of canvas width around the exact center, so it survives circular app masks. Optimize shape weight and generous negative space for instant legibility at 16px and 32px. Premium through geometry, proportion, restraint and a memorable silhouette. Generate the actual finished icon ready for export.

## Final refinement prompt

Edit this icon into a restrained, premium, production favicon. The current glowing image is NOT acceptable as a finished favicon. Keep the solar-location idea and the broad silhouette, but make these precise changes: 1) REMOVE ALL glow, blur, bloom, gradients, shading, texture and shadows. 2) Make the entire 1024x1024 canvas a FULLY OPAQUE, uniform, flat dark navy #152D43 square, edge to edge, including all corners. Absolutely no transparency anywhere. 3) Draw the mark entirely in one solid flat golden yellow #FEE50F. 4) Replace ALL the current interior half-sun and six solar-panel pieces with just ONE simple solid circular sun disc, optically centered inside the circular head of the pin, with generous navy negative space around it. 5) Keep the two broad sweeping sides of the pin joined in its downward point and the three short broad rays at the top, but refine their clean symmetric geometry. Three rays should be short and confident, not long. 6) Scale the complete yellow mark so it fits inside the central 72% diameter circle, leaving generous equal negative space; no part may be clipped by a circular app mask. This should be an extremely clean geometric two-color vector-style brand mark. No words, no presentation, no extra images. There are exactly TWO colors: flat navy background and flat yellow mark, plus only edge antialiasing. Do not add effects. Ready to downsample to 16px.
