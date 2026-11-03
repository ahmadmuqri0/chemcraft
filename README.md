# ChemCraft: The Octet Forge (web version)

Vanilla HTML/CSS/JS, no frameworks, no build step. Uses ES modules, so open it
through a local web server (double-clicking index.html will not load the modules):

```bash
cd chemcraft
python3 -m http.server 8000      # then open http://localhost:8000
```

Or use the VS Code "Live Server" extension.

## Files

    index.html          screens (menu, levels, notes, game), modals, top bar
    styles.css          design tokens, CSS grid layouts, tiles, electrons, popup
    js/main.js          entry point: wiring, progress, language + audio controls
    js/hex.js           axial hex math (neighbours, distance, rounding)
    js/grid.js          board geometry, pixel <-> hex, occupancy
    js/validator.js     bond rules: union-find groups + max-flow peg/slot matching
    js/data.js          elements and the 8 levels
    js/equation.js      formula parsing, atom balance, chemistry text formatting
    js/tiles.js         tile DOM and the dynamic electron layout
    js/game.js          drag & drop, tap-to-place, keyboard play, win detection
    js/synthesis.js     the 5-step post-synthesis popup with animations
    js/localization.js  EN / BM dictionary and live switching
    js/notes.js         KSSM Form 4 Chapter 5 notes (bilingual) + renderer
    js/audio.js         AudioManager: BGM + SFX with fallback tones
    js/ui.js            screens, accessible modals, toasts, HUD
    js/storage.js       crash-proof localStorage wrapper
    audio/README.txt    sound file names to drop in
    img/README.txt      diagram file names to drop in

## Adding a level

Add an object to LEVELS in js/data.js (cation, anion, counts, formula,
equation, tray, bilingual title and hint). The equation must balance; the
validator, HUD and popup all derive from that data.
