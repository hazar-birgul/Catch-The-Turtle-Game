# Catch the Turtle

A 60-second browser arcade game: catch as many turtles as you can before the clock runs out.
Built with TypeScript and Phaser 4.

It is a rebuild of one of my early projects — the original was a Python/Tkinter desktop game
from 2025, preserved in this repository under [`legacy/python/`](legacy/python/).

## Play

**[Play Catch the Turtle](https://hazar-birgul.github.io/Catch-The-Turtle-Game/)**

Runs directly in the browser on desktop and mobile. No installation required.

## Gameplay

- One 60-second round. No difficulty menu, no round-length options.
- Click or tap a turtle to catch it; clicking empty space counts as a miss.
- Consecutive catches build a combo multiplier: ×2 at 3 in a row, ×3 at 6, ×4 at 10.
- A miss, or a turtle escaping before you reach it, resets the combo.
- Difficulty ramps during the round — turtles spawn faster, get smaller, and leave sooner.
- Two targets: the **Normal** turtle is worth 10 points, the **Golden** turtle 50. The Golden
  one is rarer and disappears faster.
- The HUD tracks score, time, combo and accuracy live.
- The end-of-round summary reports score, accuracy, max combo, turtles caught and Golden
  turtles caught, plus misses, escapes and total spawns.
- The high score is kept in browser storage and survives a reload.
- Rounds can be paused and resumed, replayed, or abandoned back to the menu.
- Catches have visual and audio feedback; misses and broken combos get lighter cues.
- Reaching a new combo tier is highlighted, and the Golden turtle has its own stronger
  visual and audio response.
- The closing seconds add countdown urgency, and the round ends on a brief hand-off to the
  summary.
- Sound can be muted at any time during a round.

Artwork is still placeholder — turtles, buttons and panels are drawn programmatically, and
the game ships no image files. Sound effects are generated specifically for this project;
provenance is documented in [`public/assets/ASSETS.md`](public/assets/ASSETS.md).

## Controls

| Input          | Action                            |
| -------------- | --------------------------------- |
| Mouse or touch | Catch turtles                     |
| `Esc` or `P`   | Pause and resume                  |
| `SFX` button   | Toggle sound                      |
| On-screen      | Play, pause, resume, replay, menu |

## Tech stack

TypeScript · Phaser 4 · Vite · Vitest · ESLint · Prettier · GitHub Actions · GitHub Pages

Phaser is the only runtime dependency. There is no UI framework, state-management library or
physics engine — the menus, HUD and overlays are Phaser scenes, so there is one rendering
system and one input system.

## Architecture

```text
Phaser scenes / UI          rendering, input, lifecycle
        │
        ▼
Pure gameplay systems       scoring · difficulty · spawning
        │
        ▼
Configuration / persistence balance values · local storage
```

Scoring, combo, difficulty and spawn selection are plain TypeScript modules that never import
Phaser, so they can be tested without starting the engine. Scenes are adapters: they own the
clock, the timers, the display list and the pointer, and delegate every decision to those
modules. `StorageService` handles persistence behind a small injectable interface, so it is
testable in Node and degrades to an in-memory value when browser storage is blocked.

Randomness is injected as a `RandomSource` rather than called directly, which lets production
use Phaser's seeded generator while tests supply a fixed sequence and assert exact spawn
outcomes.

The game world is a fixed 960×540 logical space. On high-DPI displays the canvas is rendered
at a higher resolution and each scene camera is zoomed to match, so world coordinates,
gameplay sizes and hit areas stay unchanged while the image stays sharp.

Every tuning value lives in `src/config/balance.ts` rather than being spread through the
scenes. Presentation timing and audio behaviour are kept in separate modules, so visual and
sound feedback cannot affect scoring, spawning or difficulty.

## Quality

- Strict TypeScript (`noUncheckedIndexedAccess`, no implicit `any`), used as a type checker only.
- The pure gameplay systems, storage layer and path/render-scale helpers are unit tested.
- `npm run check` runs lint, format, typecheck, test and build. CI runs the same gate on pull
  requests, and the deploy workflow runs it again before publishing to Pages.
- Deployment base paths are derived rather than hard-coded, so the same build works at `/`
  locally and under the repository subpath on GitHub Pages.

## Development

```bash
git clone https://github.com/hazar-birgul/Catch-The-Turtle-Game.git
cd Catch-The-Turtle-Game
npm install
npm run dev
```

The dev server runs at `http://localhost:5173/`. Node 22.13+ or 24+ is required.

```bash
npm run check     # lint, format, typecheck, test, build
npm run test      # unit tests
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

Pushing to `main` runs the same checks and deploys to GitHub Pages.

## Project history

The original 2025 Python/Tkinter implementation is preserved unmodified under
[`legacy/python/`](legacy/python/) and tagged `v1.0-python`. The browser version is a rebuild
rather than a port, focused on cleaner separation between gameplay rules and presentation,
unit-tested logic, responsive rendering and an automated deployment pipeline.

## License

[MIT](LICENSE) for the source code.

The image and audio files under `legacy/python/` are **not** covered by that license. They are
kept only as historical material from the original version; their provenance is not documented
and they are not used by the browser game.
