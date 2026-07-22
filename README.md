# Hubtown — Real Estate Marketing Site

Static marketing site for Hubtown, a Mumbai real-estate developer.
Scroll-driven video backgrounds, an interactive projects map, and
per-property interior tours.

## Pages

| Page | What it does |
|---|---|
| `index.html` | Scrub-video hero, six scroll-locked panels |
| `projects.html` | Zoomable map of Mumbai with filterable project markers |
| `interiors.html` | Per-property room tour — `?p=hubtown-solaris` |
| `careers.html` | Open roles with scramble-reveal text |
| `apply.html` | Application form (preview only, does not submit) |

Interiors adapt to building type: commercial towers show reception /
workspace / boardroom, residential show living room / bedroom / kitchen.

## Run locally

```bash
node serve.js        # http://localhost:8080
```

The bundled server supports HTTP byte ranges, which the scrub videos
need in order to seek. Opening the HTML directly via `file://` will
break video scrubbing.

## Structure

```
assets/          per-page CSS + JS, shared base.css
uploads/
  images/
    careers/     role portraits (4:5)
    projects/    map card thumbnails (16:9)
    interiors/   <project-slug>/<room>.jpeg
  *.mp4          scrub-driven background video
skills/          image-generation prompt specs
```
