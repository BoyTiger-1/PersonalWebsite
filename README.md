# ronitagarwal.dev

My personal site. Dark, project-first, and built from scratch with no framework and no build step, just HTML, CSS, and vanilla JavaScript. GSAP drives the scroll motion and everything else is plain DOM and canvas. It stays light: the canvas visuals cap at 30fps and pause off screen, motion is transform and opacity only, and there is no heavy background shader.

## What's in here

```
index.html        all sections and the real content
css/style.css     the design system (ember-on-black, type scale, responsive)
js/visuals.js     five canvas animators, one per project
js/main.js        intro, reveals, stacking scroll, tilt, cursor, easter eggs
assets/           favicon and the social card
```

## Sections

- A short intro (name plus a progress bar) that fades into the hero
- Hero: the stacked name over a soft ember glow
- A scrolling ticker of headline wins
- Selected Work: five shipped projects as sticky cards that stack as you scroll, each with a live canvas visual, 3D-tilt window, and tech stack
- By the Numbers: five count-up figures with the headline stat featured
- Awards: the full record, numbered, with medal accents
- Leadership and impact: cards led by a single big metric
- About and skills
- Contact

## The project visuals

Instead of screenshots, each project has a small canvas animation that runs only while it's on screen:

- Wildfire Risk AI: a flowing risk heatmap through an ember gradient
- MindFlow AI: a slow breathing core with concentric rings
- FinQuest AI: rising bars with a live trend line
- BrailleVision: braille cells that spell VISION with a reading sweep, and occasionally scramble and resolve
- Prosperity Empire: an isometric grid of blocks that build up

## Run it

No install needed. Any static server works:

```
# python
python -m http.server 5173

# or node
npx serve .
```

Then open http://localhost:5173. Or just open `index.html` in a browser.

## Deploy

It's fully static, so drop the folder on any host:

- GitHub Pages: push and enable Pages on the branch root
- Vercel or Netlify: import the repo, no build command, output is the repo root

## Accessibility and performance

- Works with JavaScript disabled: all content is in the HTML
- Honors `prefers-reduced-motion`: animations drop to a single static frame
- Keyboard skip link, focus styles, and labeled links
- Canvas loops pause when off screen to keep it light

Built and maintained by Ronit Agarwal. Contact: ronit_agarwal@outlook.com
