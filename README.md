# Catch the Turtle

A browser arcade game: catch as many turtles as you can in 60 seconds.

The project started in 2025 as a Python/Tkinter desktop game — an early learning project — and
has since been rebuilt as a TypeScript and Phaser 4 browser game. The original is preserved
under [`legacy/python/`](legacy/python/); the repository root is the rebuild.

## Play

Intended deployment URL: `https://hazar-birgul.github.io/Catch-The-Turtle-Game/`

GitHub Pages has not been enabled for this repository yet, so that link is not live. The
deployment workflow is in place and publishes on push to `main` once Pages is turned on.
Until then, run it locally (see [Local development](#local-development)).

## Gameplay

- One 60-second round. No difficulty menu, no round-length options.
- Click or tap a turtle to catch it. Clicking empty space counts as a miss.
- Consecutive catches build a combo multiplier, up to ×4.
- A miss or a turtle escaping resets the combo.
- Difficulty ramps during the round: turtles spawn faster, shrink, and leave sooner.
- Two targets. The **Normal** turtle is worth 10 points; the **Golden** turtle is worth 50,
  appears less often, and leaves sooner.
- The summary reports score, accuracy, max combo, turtles caught and Golden turtles caught.
- The high score is stored in the browser and survives a reload.
- Rounds can be paused and replayed.

Artwork is still placeholder: turtles, buttons and panels are drawn programmatically, and the
game ships no image or audio files. There is no sound yet.

## Controls

| Input          | Action                      |
| -------------- | --------------------------- |
| Mouse or touch | Catch turtles               |
| `Esc` or `P`   | Pause and resume            |
| On-screen      | Pause, resume, replay, menu |

## Tech stack

TypeScript · Phaser 4 · Vite · Vitest · ESLint · Prettier · GitHub Actions · GitHub Pages

Phaser is the only runtime dependency. There is no UI framework, state-management library or
physics engine — menus, HUD and overlays are Phaser scenes, so there is one rendering system
and one input system.

## Architecture

```text
Phaser scenes / UI          presentation, lifecycle, input
        │
        ▼
Pure gameplay systems       scoring · difficulty · spawning
        │
        ▼
Config + persistence        balance values · local storage
```

Gameplay rules are plain TypeScript modules that never import Phaser, so scoring, combo,
difficulty and spawn behaviour can be tested without starting the engine. Scenes are adapters:
they own the clock, the timers and the display list, and delegate every decision to those
modules. Randomness is injected as a `RandomSource`, which lets production use Phaser's seeded
generator while tests supply a fixed sequence and assert exact outcomes.

The game world is a fixed 960×540 logical space. On high-DPI displays the canvas is rendered at
a higher resolution and each scene camera is zoomed to match, so the world coordinates,
gameplay sizes and hit areas are unchanged while the image stays sharp.

Every tuning value lives in `src/config/balance.ts` rather than being scattered through the
scenes.

## Quality

- Strict TypeScript (`noUncheckedIndexedAccess`, no implicit `any`), used as a type checker only.
- The pure gameplay systems, storage layer and path/render-scale helpers are unit tested.
- `npm run check` runs lint, format, typecheck, test and build; CI runs the same gate on
  pull requests, and the deploy workflow runs it again before publishing.
- Deployment base paths are derived rather than hard-coded, so the build works both at `/`
  locally and under the repository subpath on GitHub Pages.

## Local development

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
npm run preview   # serve the production build
```

## Project history

The original 2025 Python/Tkinter implementation is preserved unmodified under
[`legacy/python/`](legacy/python/) and tagged `v1.0-python`. The current application is a
browser rebuild focused on cleaner architecture, testing, responsive rendering and automated
deployment.

## License

[MIT](LICENSE) for the source code.

The image and audio files under `legacy/python/` are **not** covered by that license. They are
retained only as historical material from the original version; their provenance is not
documented and they are not used by the browser game.
