# CLAUDE.md

Persistent project context for Claude Code sessions in this repository.

## How to read this file

Every substantive statement carries one of four tags. **Never treat a `[PLANNED]` or
`[IDEA]` item as existing architecture.**

| Tag            | Meaning                                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **[VERIFIED]** | A fact about the repository as it exists right now, checked against the files or by running them.                                            |
| **[LEGACY]**   | Behaviour or architecture belonging to the original Python/Tkinter implementation, preserved under `legacy/python/`. Reference only.         |
| **[PLANNED]**  | Architecture or features approved for the browser rebuild but **not yet built**. Items marked _(proposed)_ still await the owner's sign-off. |
| **[IDEA]**     | Possible future features. Not approved, not scheduled, must not be built without being asked.                                                |

## Current project phase [VERIFIED]

**P0 (legacy preservation), P1 (foundation + deployment pipeline), P2 (core game logic)
and P3 (playable grey-box) are complete.**

The repository contains a **playable** TypeScript/Phaser 4/Vite game. The full core loop
exists in code: Menu → 60-second round → spawning, catching, missing, escaping, combo,
progressive difficulty, Golden turtles → Game Over summary → Replay or Menu, with a pause
overlay and a persisted high score. **160 tests pass.**

**Visuals are deliberately temporary.** Every turtle, button and panel is drawn with
generated shapes and Phaser text; the game still ships **zero** image and audio files.
There is no sound, no particles, no floating score text, no screen shake, no settings
screen and no How to Play. Those are P4–P6 and must not be described as existing.

**[VERIFIED] The game has not been run in a browser.** Browser automation was unavailable
in both the P1 and P3 sessions (the Chrome extension was not connected), so verification
remains static + HTTP-level. See §6 for the exact manual QA that is still outstanding.
Do not claim the canvas paints or that pointer input fires until a human confirms it.

---

## 1. Project overview

**[VERIFIED]** Repository `https://github.com/hazar-birgul/Catch-The-Turtle-Game`, owner
Hazar Birgül (`hazar-birgul`), branch `main`. The original Python implementation is
commit `97807ed` "version 1.0 added" (2025-05-16), tagged **`v1.0-python`** (local tag,
not yet pushed).

**[VERIFIED]** The project is being rebuilt as a 2D **browser** arcade game. The success
criterion: _a visitor opens the GitHub repository, clicks the live demo link, and plays
immediately with nothing to install._

**[VERIFIED]** The repository tells an honest evolution story — the original Python game
is preserved under `legacy/python/`, not deleted or disguised — while the repository root
is the modern browser game.

**[PLANNED]** Core identity is fixed: the game stays **Catch the Turtle** — click/tap
turtles that appear around the play area, score as high as possible before time runs out.

### Approved product decisions for v1.0 [VERIFIED as decisions; [PLANNED] as features]

Locked by the owner:

1. A single standard **60-second** arcade round.
2. **No configurable difficulty levels** (the legacy level selector is removed).
3. **No configurable round duration.**
4. Difficulty **progresses dynamically during the round**.
5. v1.0 ships at least two turtle types: **Normal** and **Golden**.
6. **One comparable high score** is the competitive metric.
7. Endless / Time Attack and similar modes are post-v1.0 `[IDEA]`s.
8. **No backend.**
9. The game must remain fully playable as a **static GitHub Pages site**.

---

## 2. Technology stack [VERIFIED]

Installed and working. All direct dependencies are **pinned exactly** (no `^`/`~`) so a
major version can never drift in accidentally.

| Concern            | Package                  | Version |
| ------------------ | ------------------------ | ------- |
| Game framework     | `phaser`                 | 4.2.1   |
| Build tool         | `vite`                   | 8.2.2   |
| Language           | `typescript`             | 6.0.3   |
| Test runner        | `vitest`                 | 5.0.0   |
| Linter             | `eslint`                 | 10.10.0 |
| Lint presets       | `@eslint/js`             | 10.0.1  |
| TS lint rules      | `typescript-eslint`      | 8.69.0  |
| Lint/format bridge | `eslint-config-prettier` | 10.1.8  |
| Global defs        | `globals`                | 17.12.0 |
| Formatter          | `prettier`               | 3.9.6   |
| Node types         | `@types/node`            | 22.20.1 |

**Production dependency tree is `phaser@4.2.1` → `eventemitter3@5.0.4` and nothing else.**
137 packages total including dev. `npm audit`: **0 vulnerabilities**.

**[VERIFIED] Node:** developed on v22.22.3 / npm 10.9.8. `package.json` declares
`engines.node` as `^22.13.0 || >=24.0.0`; CI uses Node 22.

**[VERIFIED] Why TypeScript 6.0.3 and not 7.0.2.** TypeScript 7.0.2 is the current npm
`latest`, but `typescript-eslint@8.69.0` declares a peer range of `>=4.8.4 <6.1.0`.
Installing TS 7 would break `npm run lint`. 6.0.3 is the newest stable TypeScript the
whole toolchain supports. **Revisit when typescript-eslint adds TypeScript 7 support.**

**[VERIFIED] Phaser 4, not Phaser 3.** Confirmed against npm: `phaser@latest` is 4.2.1 and
no newer stable 4.x patch exists. Phaser 3 APIs must not be assumed — Phaser 4 ships its
own documentation set at `node_modules/phaser/skills/*/SKILL.md`, which is the
authoritative reference. Confirmed present in 4.2.1 and used here: `import Phaser from
'phaser'` (default import), `Phaser.AUTO`, `Phaser.Scale.FIT`, `Phaser.Scale.CENTER_BOTH`,
`Phaser.Types.Core.GameConfig`, `this.load.setBaseURL()`, `Phaser.VERSION`.

**[VERIFIED] No React, Vue, CSS framework, state-management library, or physics engine.**
Menus, HUD and overlays are Phaser scenes and game objects: one rendering system, one
input system, no DOM↔canvas coordinate synchronisation, smaller bundle.

**[PLANNED] Do not add dependencies casually.** The list above is the approved set.
Anything else needs an explicit reason and the owner's approval.

---

## 3. Repository structure [VERIFIED]

```
Catch-The-Turtle-Game/
├── index.html                  # page shell: viewport, centring, touch/selection rules
├── package.json                # exact-pinned deps, npm scripts
├── package-lock.json
├── tsconfig.json               # strict type-checking config (tsc is checker only)
├── vite.config.ts              # Vite + Vitest config; derives the Pages base path
├── eslint.config.js            # flat config, type-aware rules
├── .prettierrc.json  .prettierignore
├── .gitignore
├── LICENSE                     # MIT for the source, with a legacy-asset scope note
├── CLAUDE.md                   # this file
├── .github/workflows/
│   ├── ci.yml                  # PRs + non-main pushes: lint, format, typecheck, test, build
│   └── deploy.yml              # push to main: same checks -> build -> Pages artifact -> deploy
├── public/
│   └── .nojekyll               # copied verbatim into dist/
├── src/
│   ├── main.ts                 # bootstraps Phaser.Game onto #game-root
│   ├── vite-env.d.ts           # vite/client types (import.meta.env)
│   ├── config/                 # Phaser-free except gameConfig.ts
│   │   ├── dimensions.ts       # GAME_WIDTH / GAME_HEIGHT (960x540)
│   │   ├── balance.ts          # ALL gameplay tuning + validateBalance()
│   │   ├── balance.test.ts
│   │   ├── turtleTypes.ts      # Normal + Golden, as immutable data
│   │   └── gameConfig.ts       # the only Phaser-aware config file
│   ├── systems/                # PURE gameplay rules - no Phaser, no DOM
│   │   ├── random.ts           # RandomSource contract + contract guard
│   │   ├── scoring.ts          # RoundState, combo, accuracy, RoundResult
│   │   ├── scoring.test.ts
│   │   ├── difficulty.ts       # difficultyAt(elapsedMs, curve)
│   │   ├── difficulty.test.ts
│   │   ├── spawn.ts            # weighted selection + placement
│   │   └── spawn.test.ts
│   ├── services/
│   │   ├── StorageService.ts   # injectable storage, ctt:save:v1
│   │   └── StorageService.test.ts
│   ├── entities/
│   │   └── Turtle.ts           # the catchable target + its generated placeholder art
│   ├── scenes/                 # the only Phaser-aware gameplay code
│   │   ├── BootScene.ts        # configures the loader base URL, starts Menu
│   │   ├── MenuScene.ts        # TEMPORARY menu: title, best score, Play
│   │   ├── GameScene.ts        # the round: clock, spawner, input, HUD wiring
│   │   ├── PauseScene.ts       # overlay launched over a paused GameScene
│   │   └── GameOverScene.ts    # summary, high-score submission, Replay / Menu
│   ├── ui/                     # shared presentation, no gameplay rules
│   │   ├── theme.ts            # font stack and colour tokens
│   │   ├── Button.ts           # rectangle + label + pointer press
│   │   └── Hud.ts              # in-round score / time / combo / accuracy band
│   └── utils/
│       ├── paths.ts            # deployment base-path resolution
│       ├── paths.test.ts
│       └── phaserRandom.ts     # Phaser RandomDataGenerator -> RandomSource adapter
└── legacy/
    └── python/                 # the original 2025 game, preserved unmodified
        ├── README.md           # written for this move; explains the preservation
        ├── main.py             # byte-identical to commit 97807ed
        ├── click.wav  image.jpg  image.png  image_2.png
        ├── sound_on.png  sound_off.png  time_end.png
        ├── .idea/              # original PyCharm project files
        └── __pycache__/        # original committed bytecode
```

**[VERIFIED] Directories are created only when needed.** `entities/` and `ui/` arrived
with P3 because P3 wrote the code that fills them. There is still deliberately no
`types/` or `public/assets/` — they arrive with the code that populates them (§19). Do not
pre-create empty scaffolding. Types live beside the module that owns them rather than in a
shared `types/` barrel.

**[VERIFIED] `src/utils/` is not inside the Phaser-free boundary.** Rule 7 restricts
`src/systems/**` and `src/services/**` only. `utils/paths.ts` happens to be engine-free;
`utils/phaserRandom.ts` deliberately is not — it is the adapter that supplies the engine's
generator to the pure systems, and importing it from a Node test fails with
`ReferenceError: window is not defined`, which is the boundary working as intended.

---

## 4. Commands [VERIFIED — all run and pass]

```bash
npm install          # or npm ci in CI
npm run dev          # Vite dev server on http://localhost:5173/ (base '/')
npm run build        # production build into dist/
npm run preview      # serve the production build locally
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run lint:fix     # eslint . --fix
npm run format       # prettier --write .
npm run format:check # prettier --check .
npm run test         # vitest run
npm run test:watch   # vitest
npm run check        # lint + format:check + typecheck + test + build (the CI gate)
```

**[VERIFIED] Current build output:** `dist/index.html` ~2.2 kB and one JS chunk of
~1,394 kB (~364 kB gzipped), which is almost entirely Phaser — the whole P3 game layer adds
about 16 kB to it. `build.chunkSizeWarningLimit`
is raised to 1600 in `vite.config.ts` so the default 500 kB warning does not fire on every
build and train us to ignore it.

---

## 5. GitHub Pages base-path strategy [VERIFIED]

The site is served from a project subpath, `https://hazar-birgul.github.io/Catch-The-Turtle-Game/`,
while local development runs at `/`. Getting this wrong is the classic
"works locally → 404 on GitHub Pages" failure, so it is solved in one place.

**`src/utils/paths.ts` owns all of it** and is covered by 16 unit tests:

- `resolveBase(env)` decides the deployment base, in priority order:
  1. `VITE_BASE` if set and non-blank — an explicit override for any host.
  2. `GITHUB_REPOSITORY` ("owner/repo") in GitHub Actions, from which the repository name
     is **derived rather than hard-coded**. A `owner.github.io` user/org site correctly
     resolves to `/`.
  3. Otherwise `/`, which is what `vite dev` and `vite preview` need.
- `normalizeBase(base)` guarantees a single leading and trailing slash.
- `joinBase(base, path)` joins asset paths without producing `//`, and passes absolute and
  protocol-relative URLs through untouched.

`vite.config.ts` calls `resolveBase(process.env)` to set Vite's `base`.

**The runtime half matters just as much.** Vite rewrites URLs it can see at build time,
but **Phaser's loader takes runtime strings that Vite cannot rewrite**. `BootScene.preload()`
therefore calls:

```ts
this.load.setBaseURL(joinBase(import.meta.env.BASE_URL, ASSET_BASE_PATH));
```

so every future `this.load.image('turtle', 'sprites/turtle.png')` resolves to
`<base>/assets/sprites/turtle.png`. **Any new runtime URL must go through the deployment
base the same way.**

**[VERIFIED] `deploy.yml` additionally uses `actions/configure-pages@v5`** and passes its
`base_path` output as `VITE_BASE`. That is the authoritative source for this Pages site and
keeps working if a custom domain (served from the domain root) is ever configured.

**[VERIFIED] `public/.nojekyll`** is copied into `dist/` and served. Strictly speaking the
artifact-based Pages flow never runs Jekyll, so this is insurance rather than a
requirement — it costs nothing and protects against a future switch to branch-based Pages.

---

## 6. Verification status [VERIFIED]

Run against this repository:

| Check                                                   | Result                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------ |
| `npm run lint`                                          | pass, 0 problems                                             |
| `npm run format:check`                                  | pass                                                         |
| `npm run typecheck`                                     | pass, 0 errors                                               |
| `npm run test`                                          | pass, **160/160 tests** across 6 files                       |
| `npm run build` (base `/`)                              | pass; emits `src="/assets/…"`                                |
| `npm run build` with `GITHUB_REPOSITORY` set            | pass; emits `src="/Catch-The-Turtle-Game/assets/…"`          |
| `npm run build` with `VITE_BASE=/Catch-The-Turtle-Game` | pass; identical output to the line above                     |
| Dev server over HTTP                                    | `/` 200, `/src/main.ts` 200 and transformed, Phaser resolved |
| `vite preview` under the subpath                        | `/Catch-The-Turtle-Game/` 200, JS asset 200, `.nojekyll` 200 |
| `npm audit`                                             | 0 vulnerabilities                                            |

**[VERIFIED] Additional P3 checks that did run:**

| Check                                                          | Result                                                                                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Dev server serves every new module transformed                 | 200 for `GameScene`, `PauseScene`, `GameOverScene`, `Turtle`, `Hud`, `phaserRandom`                                                         |
| `grep` for Phaser imports under `systems/` and `services/`     | none                                                                                                                                        |
| `grep` for `Math.random()` anywhere in `src/`                  | none outside comments                                                                                                                       |
| `grep` for legacy asset references in `src/` and `index.html`  | none                                                                                                                                        |
| New runtime URLs added by P3                                   | none — P3 loads no assets at all (§18)                                                                                                      |
| Headless 60-second round simulation (throwaway, not committed) | 73–79 spawns, Golden turtles selected, 0 placement failures, every target inside the HUD-safe band, `hits + escaped + leftover === spawned` |

**[VERIFIED] STILL NOT verified: anything that requires a browser.** Browser automation was
unavailable in both the P1 and the P3 session (the Chrome extension was not connected), so
no one has confirmed that the canvas paints, that the Scale Manager letterboxes correctly,
or that a single pointer event has ever fired. **Everything below is outstanding manual QA**
and must not be reported as done:

- **Menu** — renders; best score renders; Play starts the round.
- **Gameplay** — timer counts down from 60; turtles spawn; a tap scores; empty space is a
  miss; combo builds; a miss and an escape both reset it; difficulty visibly rises; two
  targets coexist late; a Golden turtle appears and is worth more; the HUD stays readable.
- **Pause** — Escape, `P` and the HUD button all pause; the clock, spawning and target
  lifetimes all freeze; Resume continues; Menu leaves no background activity.
- **Game Over** — the round ends once; no input scores afterwards; score, accuracy, max
  combo and Golden count are correct; the best score updates; Replay and Menu both work.
- **Regression** — Game → Replay → Replay → Menu → Game, confirming spawn rate and
  difficulty do not compound (the legacy game's worst defect, §17).
- **Responsiveness** — different viewport sizes, and touch on a real device.

---

## 7. Application architecture [VERIFIED]

### The layering rule

```
config/  ─┐
systems/  ├─ pure, engine-free, unit-tested        (never imports Phaser)
services/─┘
              ▲ consumed by
scenes/   ─┐
entities/  ├─ Phaser adapters: rendering, input, timing
ui/       ─┘
```

`GameScene` is an **adapter, not a rulebook**. It owns what only Phaser can own — the
clock, the timers, the display list, the pointer — and delegates every decision to P2:
`difficultyAt` for pacing, `buildSpawnPool` + `selectTurtleType` for what to spawn,
`findSpawnPosition` for where, and `systems/scoring` for what a catch, a miss or an escape
does. Nothing in `scenes/` recomputes any of it. A gameplay number appearing in a scene is
a bug; it belongs in `config/balance.ts`.

### Scene graph

```
BootScene ──▶ MenuScene ──▶ GameScene ──▶ GameOverScene ──┬──▶ GameScene  (Play Again)
                  ▲              ▲                        └──▶ MenuScene
                  │              │
                  │        PauseScene  (scene.launch over a scene.pause'd GameScene)
                  └──────────────┘   (Main Menu, from Pause or from Game Over)
```

Scenes address each other by **string key**, not by importing each other's classes, so two
scenes that start each other never form an import cycle. `HowToPlayScene` and
`SettingsScene` from the P2-era plan **do not exist** and are still [PLANNED].

Screen state lives in the Phaser SceneManager. That is not the legacy mistake: Phaser
scenes are explicit, addressable by key, have lifecycle hooks, and accept typed data at
transition — unlike the legacy game, where "which frame is packed" _was_ the screen.

### Scene responsibilities

- **`BootScene`** — sets the loader base URL (§5), starts `Menu`. Loads no assets, because
  none exist.
- **`MenuScene`** — title, both turtle variants as a preview, the stored best score, and
  one Play button. Still temporary. **No difficulty or duration selector**, per the locked
  product decisions. Also renders the resolved base path, so a broken deployment is obvious
  on sight.
- **`GameScene`** — the round. Detailed below.
- **`PauseScene`** — overlay. Detailed below.
- **`GameOverScene`** — summary. Detailed below.

### GameScene lifecycle

| Hook       | What happens                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `init`     | **Every** piece of round state is reset here: status, elapsed time, `RoundState`, target list, spawn timer, RNG, exclusion zones.                                        |
| `create`   | Generates the turtle textures, draws the playfield, builds the HUD, registers the pointer and keyboard handlers and the `shutdown` hook, then schedules the first spawn. |
| `update`   | Advances the round clock, refreshes the countdown when the displayed second changes, ends the round at zero.                                                             |
| `shutdown` | Cancels the pending spawn tick and destroys any remaining targets.                                                                                                       |

`init` rather than the constructor is the whole replay guarantee: the constructor runs once
per game, `init` runs on every start including a Replay.

### The round clock

**One authoritative clock: `elapsedMs`, accumulated from the frame `delta` in `update`.**

- The countdown, the difficulty curve and the spawn interval all read this single value, so
  they cannot drift apart the way a chain of one-second timer events would.
- Phaser does not call `update` on a paused scene, so **pausing freezes the round for
  free** — there is no `paused` flag anywhere in the gameplay code.
- Duration comes from `BALANCE.round.durationMs`; `60000` appears nowhere in a scene.
- Elapsed time is clamped to the duration, and remaining seconds are
  `max(0, ceil((duration - elapsed) / 1000))`, so the HUD reads 60 at the start and 0 at the
  end and never goes negative.
- `Phaser.Time.Clock.now` is deliberately **not** used: it tracks wall time and keeps
  advancing while the scene is paused.

### Round status

`'running' | 'ending' | 'ended'`, and nothing more elaborate. `endRound()` returns
immediately unless the status is `running`, so the end of the round **cannot execute
twice**. `ending` is the window in which input is already refused but the summary has not
been handed over; `ended` means the transition is queued.

### Spawn scheduler

**A one-shot `delayedCall` chain, never a looping timer**, because `spawnIntervalMs` changes
continuously through the round and a repeating timer would be stuck with the interval it was
created with.

```
tick → difficultyAt(elapsedMs) → try to spawn → schedule the next tick at that
       tick's spawnIntervalMs
```

Guarantees, in order of how badly the legacy game got them wrong:

- **Exactly one scheduler exists.** Each tick schedules exactly one successor, and the
  reference is stored in a single field. Replay cannot stack a second chain — the legacy
  game's compounding-difficulty defect (§17, defects 1–3).
- It stops at the end of the round, because the tick returns early unless the status is
  `running`.
- It cannot survive scene shutdown: the timer belongs to the scene's Clock, and `shutdown`
  removes it explicitly as well.
- Pause cannot cause background spawning, because a paused scene's Clock does not tick.

The opening delay before the first tick is `BALANCE.spawn.firstSpawnDelayMs`.

### Concurrency and placement

At each tick, in order:

1. If the number of live targets is already at `difficultyAt(elapsed).maxConcurrent`,
   **skip**.
2. Otherwise pick a variant from the ramped weights and compute
   `scale = difficulty.targetScale × definition.scaleMultiplier`.
3. Ask `findSpawnPosition` for a position, passing the live targets' centres. Margin,
   minimum separation and the attempt budget all default to `BALANCE.spawn`.
4. **If it returns `null`, skip the tick** — the P2 contract (§13). No fallback placement.

A tick that spawns nothing is normal and costs nothing; the next tick is already scheduled.

**[VERIFIED] `maxConcurrent: 3` is currently a non-binding ceiling.** A headless simulation
of the full round reaches two live targets, never three: at full ramp the spawn interval is
480 ms while a Normal turtle lives 950 ms, so a third can essentially never overlap. This is
a balance observation, not a defect — the cap is doing no harm — and it is the kind of thing
to revisit with real play data in P6, not to retune blind.

### Turtle entity

`src/entities/Turtle.ts` — **one class, no subclasses.** A turtle is configured entirely by
the `TurtleTypeDefinition` it is handed, so adding a variant needs no new class and no
branch.

- **Placeholder art is generated, not loaded**: a `Graphics` object draws a shell, head,
  four legs, shell plates and eyes per variant, baked once into a texture with
  `generateTexture`. Each turtle is then a plain `Phaser.GameObjects.Image`, which is a cheap
  textured quad rather than a Graphics command buffer replayed every frame. The two variants
  are told apart by colour, derived from `placeholderColor`.
- **Sizing and hit area come from one number.** `BALANCE.spawn.targetBaseRadiusPx` drives
  the drawing, the radius handed to `findSpawnPosition`, and the `Phaser.Geom.Circle` hit
  area. The hit circle is expressed in un-scaled texture space and Phaser transforms the
  pointer into that space, so the clickable radius tracks `setScale` automatically. **The
  visual and the hitbox cannot disagree** — the structural fix for legacy defect 12.
- **A target resolves exactly once.** `claim()` returns `true` for the first caller only and
  cancels the expiry timer on the way, so a click landing in the same frame the lifetime
  expires cannot register both a hit and an escape.
- `destroy()` is overridden to cancel the expiry timer, so a target removed for any reason
  leaves no pending callback.

### Target lifecycle

| Stage     | What happens                                                                                                                                       |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spawn     | Added to the live list, `registerSpawn`, and an expiry `delayedCall` is started for `difficulty.targetLifetimeMs × definition.lifetimeMultiplier`. |
| Caught    | `claim()` → removed from the list and destroyed → `registerHit(state, definition)` → HUD.                                                          |
| Escaped   | Expiry fires → `claim()` → removed and destroyed → `registerEscape` → combo breaks → HUD.                                                          |
| Round end | `claim()` (which cancels the timer) then destroyed. **No escape is registered** — see the policy below.                                            |

### Hit and miss: one press, one outcome

**A single scene-level `pointerdown` handler decides.** Phaser emits it once per press with
the list of interactive objects under the pointer, so resolving the outcome in one place
makes "hit or miss, never both" _structural_ rather than a matter of getting event
propagation right between two listeners. **No turtle registers a `pointerdown` of its own,**
and there is no background input zone.

```
pointerdown ─┬─ a Turtle is under the pointer      → registerHit
             ├─ some other interactive object      → ignored (it is a HUD control)
             └─ nothing under the pointer          → registerMiss
```

The middle branch matters: pressing the pause button is interface input, not a failed swipe,
so it must not cost the player their combo. Presses outside the canvas (the letterbox bars)
arrive as `POINTER_DOWN_OUTSIDE` and are never seen. Every branch returns early unless the
status is `running`, so nothing is scored after the clock hits zero.

Points are never computed in the scene — `registerHit` applies the combo and the multiplier,
exactly as §11 defines them.

### HUD

`src/ui/Hud.ts`. Four read-outs in a band across the top — **SCORE**, **TIME**, **COMBO**
(shown as the effective multiplier, `x1`…`x4`, with the consecutive-hit streak in its label)
and **ACCURACY** — plus a visible pause button, so pausing is reachable on touch.

The band's height **is** `BALANCE.spawn.hudSafeTopPx`: the HUD region and the spawn keep-out
region are one number, not two that can drift apart. Accuracy renders as `—` rather than
`0%` when `attempts === 0`, per the §11 contract. The HUD holds no round state and applies
no rules; it renders the values `GameScene` hands it.

### Pause semantics

`this.scene.pause()` then `this.scene.launch('Pause')`. Pausing the scene _is_ the whole
mechanism — Phaser stops calling `update` (the round clock stops), stops ticking the Clock
(the spawn chain and every expiry freeze) and reports `canInput() === false` (a click on a
frozen turtle cannot score). Nothing is threaded through the gameplay code.

Escape and `P` pause from `GameScene` and resume from `PauseScene`. The split is required,
not stylistic: a paused scene's keyboard plugin is inactive, so the key that resumes must
belong to the scene that is actually running.

**Main Menu from the pause overlay stops `GameScene` outright** rather than leaving it
paused. A paused scene keeps its display list, timers and state alive; a stopped one is shut
down, which is what guarantees no stale spawn tick or expiry can fire behind the menu.

### End-of-round policy

**Targets still on screen when the clock reaches zero are removed without registering an
escape.** The round is over and the player cannot be expected to catch them, so taking their
combo and inflating the escape count after the timer has run out would be punishing them for
the clock. Consequently `hits + escaped + (targets alive at the buzzer) === spawned`.

In order: status leaves `running` → spawn scheduler stopped → live targets claimed and
destroyed → HUD refreshed → `summarizeRound(state)` → `scene.start('GameOver', payload)`.

### GameOver payload and high score

The result travels as a **typed Phaser scene payload**, `{ result: RoundResult }`, read in
`init(data)`. Never a module-level global — that is the legacy state model this rebuild
exists to avoid. A `GameOverScene` started without a result bounces to the menu rather than
rendering a screen of zeroes.

`GameOverScene` calls `StorageService.submitScore(result.score)` and renders **NEW BEST!**
when it reports one. The comparison is never re-derived — §14 owns it. Submitting here, not
in `GameScene`, keeps the round scene free of persistence concerns. The screen shows the
score, best, accuracy, max combo, targets caught and Golden turtles caught, with misses,
escapes and spawns as a secondary line.

**One shared `StorageService` per session**, via `getStorageService()`. This matters even
though the underlying storage is global: with persistence blocked, the service falls back to
an in-memory cache, and a fresh instance per scene would throw that cache away — the best
score would reset between rounds instead of lasting the session. The player is never shown a
storage error.

### RNG adapter

`src/utils/phaserRandom.ts` wraps a seeded `Phaser.Math.RandomDataGenerator` as the plain
`RandomSource` the systems expect (Phaser 4: `new RandomDataGenerator([seed])`, `.frac()`).
`GameScene.init` builds a fresh one per round, so no two rounds share a spawn sequence, and
`createSeededRandom(seed)` reproduces one exactly for debugging. The seed is `Date.now()`
plus a per-session counter — **not** `Math.random()`, which gameplay code never calls.

### Replay and cleanup

Replay is a fresh `scene.start('Game')`, which shuts the scene down and runs the whole
lifecycle again. What guarantees it is clean:

| Concern                   | Why it cannot leak                                                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Score, combo, elapsed     | Reset in `init`, which runs on every start.                                                                                                                          |
| Spawn scheduler           | One field, cleared in `init` and removed in `shutdown`; the Clock is destroyed with the scene either way.                                                            |
| Expiry timers             | Owned by the scene Clock; also cancelled by `Turtle.destroy()`.                                                                                                      |
| Active target list        | Emptied in `init` and again in `shutdown`.                                                                                                                           |
| Pointer/keyboard handlers | `InputPlugin.shutdown()` and `KeyboardPlugin.shutdown()` both call `removeAllListeners()` — verified in the Phaser 4 source. The scene does not duplicate that work. |
| Difficulty                | A pure function of `elapsedMs`, which restarts at 0. Nothing to reset.                                                                                               |

The `shutdown` hook therefore cleans only what Phaser does not own: this scene's references
to objects it is about to destroy.

## 8. Logical resolution and input [VERIFIED]

- **960×540 (16:9) logical resolution.** All coordinates are logical; the Scale Manager
  maps them to the device. Nothing below `gameConfig.ts` needs the real canvas size.
- **`Scale.FIT` + `CENTER_BOTH`** — preserves aspect ratio and letterboxes rather than
  distorting.
- **Pointer events only.** `pointerdown` (not `pointerup`, so hits feel immediate) covers
  mouse, touch and pen through one code path — there is no separate mobile input branch.
- **`index.html` handles the browser-level hazards:** `touch-action: none` on body and
  canvas, `overscroll-behavior: none`, `user-select: none`, `-webkit-touch-callout: none`,
  transparent tap highlight, `overflow: hidden`, and `env(safe-area-inset-*)` padding for
  notched devices. A `<noscript>` message covers a failed script load.

**[VERIFIED] Hit areas are derived from the target size**, not hard-coded:
`Turtle` sets a `Phaser.Geom.Circle` of `BALANCE.spawn.targetBaseRadiusPx` in un-scaled
texture space, which is the same number that draws the shell and that placement keeps clear.
Phaser transforms the pointer into that space, so the clickable radius tracks the display
scale automatically. This is the structural fix for legacy defect 12 (§17).

**[VERIFIED] Pause is reachable by keyboard (`Escape`, `P`) and by an on-screen button**, so
touch devices with no keyboard are not locked out of it.

**[IDEA]** `Scale.RESIZE` with a fluid layout that reflows for portrait instead of
letterboxing. Only worth it if mobile portrait proves to be a primary use case.

---

## 9. Testing [VERIFIED]

- **Vitest 5.0.0**, configured inside `vite.config.ts` (one config file, no duplication).
- `environment: 'node'`, `include: ['src/**/*.test.ts']` — tests are colocated with the
  code they cover. **No jsdom is installed and none is needed.**
- **160 tests across 6 files, all passing.**

| Suite                                 | Tests | Covers                                                                        |
| ------------------------------------- | ----- | ----------------------------------------------------------------------------- |
| `src/utils/paths.test.ts`             | 16    | GitHub Pages base-path resolution and asset URL joining                       |
| `src/config/balance.test.ts`          | 22    | `validateBalance`, shipped-balance sanity, turtle type invariants             |
| `src/systems/scoring.test.ts`         | 28    | scoring, combo tiers, misses, escapes, accuracy, round summary                |
| `src/systems/difficulty.test.ts`      | 20    | curve endpoints, clamping, monotonicity, bounds, custom curves                |
| `src/systems/spawn.test.ts`           | 41    | weighted selection, determinism, placement, exclusion, failure modes          |
| `src/services/StorageService.test.ts` | 33    | schema validation, corruption recovery, high-score, settings, shared instance |

**[VERIFIED] The rule that makes this possible: logic worth testing does not import
Phaser.** Scoring, combo, difficulty, spawn selection, spawn placement and storage
serialisation are all engine-free, so the whole suite runs in well under a second in Node.

**[VERIFIED] Scenes, entities, the HUD and rendering generally are not unit-tested** — they
are covered by manual QA. That boundary is deliberate, not a gap: P3 added no new pure logic
worth testing, only two new balance numbers and one memoised service accessor, and those did
get tests. Extracting helpers out of `GameScene` purely to raise a test count would be worse
code, not better-tested code.

**[VERIFIED] The Phaser-free boundary is enforced by reality, not just by convention.** A
throwaway test that imported `utils/phaserRandom.ts` into the Node environment failed with
`ReferenceError: window is not defined`. Any future attempt to import Phaser from
`systems/` or `services/` will break the suite the same way.

**[IDEA]** A Playwright smoke test (page loads, canvas present, no console errors) after
v1.0.

---

## 10. Gameplay balance configuration [VERIFIED]

`src/config/balance.ts` is the **single source of truth for every gameplay tuning
number**. No system defines a numeric gameplay constant of its own; each takes its config
as a parameter defaulting to `BALANCE`, which is all the flexibility tests and tuning
need. It is a plain typed constant, not a configuration framework.

| Group        | Setting              | Value                                               |
| ------------ | -------------------- | --------------------------------------------------- |
| `round`      | `durationMs`         | 60 000 (the locked product decision)                |
| `combo`      | `tiers`              | x1 from combo 0, x2 from 3, x3 from 6, x4 from 10   |
| `difficulty` | `rampDurationMs`     | 45 000                                              |
| `difficulty` | `easingExponent`     | 1.4                                                 |
| `difficulty` | `spawnIntervalMs`    | 1400 → 480                                          |
| `difficulty` | `targetLifetimeMs`   | 2200 → 950                                          |
| `difficulty` | `targetScale`        | 1 → 0.7                                             |
| `difficulty` | `maxConcurrent`      | 1 → 3                                               |
| `spawn`      | `targetBaseRadiusPx` | 46 (drives drawing, placement **and** the hit area) |
| `spawn`      | `firstSpawnDelayMs`  | 400                                                 |
| `spawn`      | `marginPx`           | 28                                                  |
| `spawn`      | `minSeparationPx`    | 96                                                  |
| `spawn`      | `maxAttempts`        | 24                                                  |
| `spawn`      | `hudSafeTopPx`       | 76                                                  |
| `spawn`      | `hudSafeBottomPx`    | 16                                                  |
| `audio`      | `defaultVolume`      | 0.8                                                 |
| `audio`      | `defaultMuted`       | false                                               |

**[VERIFIED] `validateBalance(balance)`** returns a list of human-readable problems (empty
means coherent). It checks positivity (including `targetBaseRadiusPx`, since a target with
no size would break both placement and hit testing), that `firstSpawnDelayMs` is
non-negative, that the difficulty curve gets _harder_ rather than easier in every dimension,
that combo tiers start at 0 and ascend in both threshold and multiplier, and that the
default volume is in range. It is a small helper for development
and tests, deliberately **not** a runtime schema-validation framework.

**[VERIFIED] Turtle variants** live in `src/config/turtleTypes.ts` as immutable data, with
no class hierarchy — variants differ only in numbers and appearance, so a subclass per
variant would add indirection without behaviour.

| Field                | Normal     | Golden               |
| -------------------- | ---------- | -------------------- |
| `id`                 | `normal`   | `golden`             |
| `basePoints`         | 10         | 50 (5x)              |
| `scaleMultiplier`    | 1          | 1                    |
| `lifetimeMultiplier` | 1          | 0.75 (leaves sooner) |
| `spawnWeight`        | 96 → 90    | 4 → 10               |
| `placeholderColor`   | `0x4ade80` | `0xfacc15`           |

Weights are **relative and ramped across the round** by the same eased progress the
difficulty curve uses, giving the Golden turtle ~4% of spawns early and ~10% once fully
ramped. **Adding a future variant means appending one definition** — scoring and spawning
read these fields generically and contain no per-variant branching.

---

## 11. Scoring, combo and round statistics [VERIFIED]

`src/systems/scoring.ts`. Every export is a pure function over plain serialisable data.
`RoundState` is treated as **immutable**: each `register*` function returns a new state
rather than mutating its argument.

```ts
interface RoundState {
  score: number;
  combo: number; // consecutive catches without a miss or escape
  maxCombo: number;
  hits: number;
  misses: number; // player clicks that landed on nothing
  escaped: number; // targets that expired uncaught
  spawned: number;
  caughtByType: Record<TurtleTypeId, number>;
}
```

`accuracy` is **derived, never stored**, so it cannot drift from `hits`/`misses`.
`caughtByType` is a generic record rather than named `normalCaught`/`goldenCaught` fields,
so a new variant needs no new state field.

**[VERIFIED] Combo semantics — the combo increments _before_ the reward is calculated.** A
catch is paid at the multiplier the player has just reached: the first catch of a round is
combo 1 (x1), and the third is combo 3, the first to pay x2. The alternative (pay at the
previous combo, then increment) was rejected because it makes the HUD lie — the player
would see "x2" and be paid x1.

`points = round(turtle.basePoints × comboMultiplier(comboAfterHit))`

The multiplier walks the tier staircase in `balance.ts` and returns the last tier whose
threshold is met, so tiers stay declarative data. **The x4 cap is deliberate**: it keeps a
perfect run worth roughly four times a sloppy one without letting one lucky streak make
every earlier score irrelevant.

| Operation                       | Effect                                                                     |
| ------------------------------- | -------------------------------------------------------------------------- |
| `registerSpawn(state, count=1)` | `spawned += count`. Statistics only.                                       |
| `registerHit(state, turtle)`    | combo +1, score += points, `maxCombo` updated, `hits` +1, variant counted  |
| `registerMiss(state)`           | **combo → 0**, `misses` +1. Counts as an attempt.                          |
| `registerEscape(state)`         | **combo → 0**, `escaped` +1. **Not** an attempt.                           |
| `previewHit(state, turtle)`     | `{ combo, multiplier, points }` without applying — for floating score text |
| `summarizeRound(state)`         | `RoundResult` with derived `attempts` and `accuracy`                       |

**[VERIFIED] Accuracy is `hits / (hits + misses)`.** Escaped targets are excluded on
purpose: the player never clicked, so an escape must not dilute click precision. **With
zero attempts it returns `0`, not NaN and not 1** — a player who never clicked has no
accuracy to show, and 0 reads correctly beside a score of 0. `RoundResult.attempts` is
exposed so P3 can render a dash instead when `attempts === 0`.

---

## 12. Difficulty curve [VERIFIED]

`src/systems/difficulty.ts`. A **pure function of elapsed round time** — no state of its
own, so nothing can fall out of sync with the round.

```
linear   = clamp(elapsedMs / rampDurationMs, 0, 1)
progress = clamp(linear ** easingExponent, 0, 1)
value    = start + (end - start) * progress
```

`difficultyAt(elapsedMs, curve = BALANCE.difficulty)` returns
`{ progress, spawnIntervalMs, targetLifetimeMs, targetScale, maxConcurrent }`.

- **`easingExponent` 1.4 back-loads the ramp** — halfway through the clock is less than
  halfway through the difficulty, so the opening stays approachable and the pressure
  builds late.
- **`rampDurationMs` (45 s) is shorter than the round (60 s) on purpose**, so the closing
  15 seconds are played at full intensity rather than still ramping.
- Negative and past-the-end elapsed values **clamp to the endpoints** rather than
  extrapolating. `NaN` clamps to the round start; `Infinity` clamps to fully ramped.
- `maxConcurrent` is rounded to a whole number and floored at 1, or the round could stall.

**[VERIFIED] `DifficultyParams` deliberately has no `goldenChance` field.** Variant
probability lives in the turtle definitions' ramped `spawnWeight` instead, because a
golden-specific field here would force golden-specific branching through the spawn
pipeline — exactly what the data-driven design exists to avoid. `spawnProbabilities()`
(§13) reports the real per-variant chance for HUD, telemetry and tests.

---

## 13. Spawn selection and placement [VERIFIED]

`src/systems/spawn.ts`. Two independent concerns, both pure and deterministic for a given
`RandomSource`. Neither imports Phaser: placement takes a plain rectangle and returns a
plain `{ x, y }`.

### Randomness contract [VERIFIED]

`src/systems/random.ts` defines `type RandomSource = () => number` returning `[0, 1)`.
**Gameplay code never calls `Math.random()`** — every function needing randomness takes a
`RandomSource`. **[VERIFIED]** Production injects Phaser's seeded generator through
`utils/phaserRandom.ts` (§7); tests inject a fixed sequence. We deliberately do not implement a PRNG; injection is the whole requirement.

`nextUnitInterval(random)` guards the contract: a source returning `NaN`, a negative, or a
value ≥ 1 is **clamped, not thrown on** — a malformed RNG value is a runtime condition,
and throwing would crash a live round.

### Variant selection [VERIFIED]

- `buildSpawnPool(progress, definitions = TURTLE_TYPES)` interpolates each variant's
  `spawnWeight` by the eased progress. Progress outside 0..1 clamps; non-finite throws.
- `selectTurtleType(pool, random)` does cumulative-weight selection. Zero-weight entries
  can never be selected; a trailing fallback absorbs floating-point summation error.
- `spawnProbabilities(pool)` normalises weights into probabilities — for HUD and tests.

**Invalid weights throw `RangeError`** (empty pool, all-zero total, negative, non-finite).
That is configuration error, which must fail loudly rather than silently skewing every
future spawn — as distinct from a bad RNG value, which is clamped.

### Placement contract [VERIFIED]

`findSpawnPosition(request): SpawnPosition | null` — rejection sampling with a hard
attempt budget, so it can never loop forever. It consumes exactly two random values per
attempt.

**It returns `null` when no valid position is found, rather than a best-effort
placement.** A "closest we could manage" result would silently put a turtle under the HUD
or on top of another one — a gameplay bug that is hard to spot. `null` makes the caller
decide, and the obviously correct decision for a spawner is to skip this tick and try
again on the next one. With at most three concurrent targets in 960x540 this is
effectively unreachable in normal play, so the skip costs nothing.

**Invalid input throws `RangeError` instead** — non-finite or non-positive area, negative
radius/margin/separation, or a `maxAttempts` that is not an integer ≥ 1. These are
programming errors and must never silently produce NaN coordinates. A target simply too
large for the area is a legitimate runtime state, so that returns `null`.

Placement keeps the whole target inside `margin + radius` of every edge, rejects
candidates overlapping any exclusion zone, and respects `minSeparation` from live targets.
`buildExclusionZones(area, config)` builds the HUD keep-out bands from the balance config.

---

## 14. Persistence [VERIFIED]

`src/services/StorageService.ts`. Unlike `src/systems/*`, this service may touch browser
storage — but only through a tiny injectable interface, so it is **fully tested in the
Node environment with no jsdom**.

```ts
interface StorageLike {
  getItem(key): string | null;
  setItem(key, value): void;
}
```

The constructor takes `StorageLike | null`, defaulting to `detectBrowserStorage()`, which
guards even the _lookup_ of `globalThis.localStorage` — merely accessing it throws in some
blocked-storage configurations.

**Single namespaced, versioned key: `ctt:save:v1`.** The namespace is not cosmetic: every
GitHub Pages project site shares the `<user>.github.io` origin, so an unprefixed key like
`highScore` would collide with the owner's other projects.

```json
{ "schemaVersion": 1, "highScore": 0, "settings": { "muted": false, "volume": 0.8 } }
```

**Stored JSON is never trusted.** `sanitizeSaveData` validates field by field: a
non-object or unrecognised `schemaVersion` resets to defaults; `highScore` must be a
finite non-negative number and is floored; `muted` must be a boolean; `volume` is clamped
into 0..1. **Partial corruption costs only the corrupted field** — a broken settings
object does not wipe the high score.

**Every access is guarded and the game stays playable if persistence fails**: storage
absent, `getItem` throwing, `setItem` throwing (quota, private mode), malformed JSON,
unsupported schema. `save()` returns a boolean rather than throwing, an in-memory cache
keeps the session consistent, and `isAvailable()` lets P3 surface the state. **The service
logs nothing** — blocked storage is an expected condition, not console-worthy noise.

- `submitScore(score)` → `{ highScore, isNewBest }`. Keeps the old best when the new score
  is lower **or equal**; ignores negative and non-finite scores; stores whole points only.
- `updateSettings(patch)` merges and validates. **Mute and volume stay independent**, so
  `{ volume: 0.7, muted: true }` is a valid state.
- Persists **only** high score and settings. No round state, no timers, no achievements.

**[VERIFIED] `getStorageService()` returns one shared instance for the whole session.**
`MenuScene` reads the best score from it and `GameOverScene` submits to it; a per-scene
instance would discard the in-memory fallback and reset the best score between rounds
whenever storage is blocked. **`settings` is persisted but nothing reads it yet** — audio
arrives in P4.

---

## 15. Code quality configuration [VERIFIED]

**TypeScript** (`tsconfig.json`) — `tsc` is a type checker only (`noEmit`); Vite does the
building. Enabled: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
`noFallthroughCasesInSwitch`, `noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters`,
`forceConsistentCasingInFileNames`, `verbatimModuleSyntax`, `isolatedModules`,
`moduleResolution: "bundler"`, target/lib ES2022 + DOM. `skipLibCheck` is on because
Phaser ships a very large generated `.d.ts` that reports nothing actionable.
`allowImportingTsExtensions` is on because Vite's native config loader requires an explicit
`.ts` extension on the import in `vite.config.ts`.

**ESLint** (`eslint.config.js`, flat config) — `js.configs.recommended` plus
typescript-eslint's `recommendedTypeChecked` and `stylisticTypeChecked` (type-aware rules
are where the real value is), then `eslint-config-prettier` last to switch off everything
stylistic. `projectService` is used, with `allowDefaultProject` for `eslint.config.js`
itself. `dist/`, `coverage/` and **`legacy/`** are ignored. `no-console` warns except
`warn`/`error`; unused vars are errors unless prefixed `_`.

**Prettier** (`.prettierrc.json`) — single quotes, semicolons, width 100, trailing commas,
LF endings. `.prettierignore` excludes `dist`, `coverage`, `node_modules`,
`package-lock.json` and **`legacy`** — the preserved Python code must never be reformatted.

---

## 16. CI and deployment workflows [VERIFIED]

**`.github/workflows/ci.yml`** — on pull requests to `main`, pushes to any branch **other
than** `main`, and manual dispatch. `permissions: contents: read`. Steps: checkout →
setup-node 22 with npm cache → `npm ci` → lint → format:check → typecheck → test → build.

**`.github/workflows/deploy.yml`** — on push to `main` and manual dispatch. Uses the
**official GitHub Pages artifact flow**, not a `gh-pages` branch.
`permissions: contents: read, pages: write, id-token: write`.
`concurrency: { group: pages, cancel-in-progress: false }` so a running deployment is never
cancelled mid-flight. Two jobs:

1. `build` — checkout, setup-node 22, `npm ci`, lint, format:check, typecheck, test,
   `actions/configure-pages@v5`, `npm run build` with `VITE_BASE` from the configure-pages
   `base_path` output, `actions/upload-pages-artifact@v3` on `dist`.
2. `deploy` — `needs: build`, `environment: github-pages`, `actions/deploy-pages@v4`.

Main is checked by `deploy.yml` and other branches by `ci.yml`, so the two never duplicate
work on the same commit.

**[VERIFIED] `configure-pages` is used without `enablement: true`** — turning Pages on is a
repository setting the owner performs manually (§21 rule 10).

**[VERIFIED] Not yet exercised:** these workflows have never run. They are unpushed and
uncommitted, so the action major versions (`checkout@v4`, `setup-node@v4`,
`configure-pages@v5`, `upload-pages-artifact@v3`, `deploy-pages@v4`) should be confirmed on
the first real run.

---

## 17. The legacy Python version

**[VERIFIED] Preservation.** Tagged **`v1.0-python`** (annotated, local, **not pushed**) on
commit `97807ed`, and moved with `git mv` to `legacy/python/` so history follows the files.
`main.py` is byte-identical to the commit (blob `cc7b7f1a…` in both). Nothing was fixed,
reformatted, resized or modernised. `legacy/python/README.md` was added to explain the
preservation.

**[LEGACY] What it is.** A 241-line single-file Tkinter/`turtle` desktop game, Windows-only
(`winsound`), with Pillow as its only third-party dependency. Four `tk.Frame` "screens"
swapped with `pack()`/`pack_forget()`. Level (1/2/3) and duration (30/60/90 s) chosen at a
menu; a turtle teleports to random positions; clicking within 20 px scores a point.

**[LEGACY] State model — the anti-pattern the rebuild exists to avoid.** State split across
Python globals (`high_score`, `move_job`, `timer_job`, `muted`), Tk variables doubling as
the model, and implicit widget state (which frame is packed _is_ the screen). High score
was memory-only.

**[LEGACY] Confirmed defects** (reproduced by execution before the move; recorded so the
rebuild does not reintroduce them):

1. `turtle.TurtleScreen` has **no `ontimer_cancel`** and `ontimer()` returns `None`, so
   `move_job` was always `None` and every cancellation guard was dead code.
2. Consequently the turtle never stopped moving — it kept relocating on the time-up screen,
   game-over screen and menu for the life of the process.
3. **Every replay stacked another movement chain**: 3 moves per 3.2 s → 6 after one replay
   → 9 after two. Difficulty compounded permanently.
4. `SPEED_MAP = {1: 1000, 2: 1500, 3: 700}` made Level 2 _easier_ than Level 1.
5. `final_score_var` was bound to a label but never `.set()` — the final score always
   displayed as `''`.
6. Bare relative paths for `sound_on.png`/`sound_off.png`/`click.wav` crashed the app when
   launched from any other directory.
7. Windows-only via `winsound`.
8. No error handling on asset load. 9. `start_game(replay=False)` never read `replay`.
9. `image.jpg` referenced nowhere. 11. `ts.onclick` re-registered on every relocation.
10. Hit radius hard-coded to `20`, **not derived from** `t.shapesize(2, 2)` — sprite size
    and hitbox could silently desynchronise.
11. No type hints, one docstring, zero tests, and largely untestable.

**[LEGACY] Worth keeping conceptually:** the four-screen flow, the mute toggle with on/off
icon states, correct `tracer(0)` + explicit `update()` rendering, and non-blocking
`SND_ASYNC` audio. Good instincts whose intent carries over.

---

## 18. Assets [VERIFIED]

**Every legacy image and audio file is treated as unverified for public distribution.**
No file carries source, author or licence metadata. `image.jpg` (8192×5461 progressive
JPEG) appears to be a stock photo; the 1024×1536 / 1024×1024 cartoons and icons appear to
be generator output.

**Consequences, in force now:**

- **No legacy asset is used by the modern build.** None has been copied into `public/`.
- `public/assets/` does not exist yet. The modern game currently ships **zero** image and
  audio files and draws everything programmatically — **including the P3 turtles**, whose
  placeholder textures are drawn with `Graphics` and baked with `generateTexture` at scene
  start. Nothing is fetched at runtime, so P3 added no runtime URLs at all (§5).
- Legacy files are preserved under `legacy/python/` as historical material only.
- `LICENSE` covers the source code and carries an explicit scope note excluding the legacy
  media.

**[VERIFIED] Three structural problems with the legacy art**, recorded so they are not
repeated:

1. **Text is baked into the images** ("Play Again", "Catch me if you can", "Time is up").
   Blocks restyling and localisation and scales blurrily. **New art must ship text-free;
   all text is rendered by Phaser.**
2. **The gameplay protagonist has no art.** The cartoons are screen decorations; the thing
   the player clicked was Python's built-in turtle polygon. An actual turtle sprite is the
   single largest asset gap.
3. **Three incompatible visual languages** — photograph, cartoon illustration, flat vector.

**[PLANNED] Art phase requirements:** text-free, sized for 960×540, packed into a texture
atlas, tintable so turtle variants can share one texture, with documented ownership or
licence. An `ASSETS.md` crediting each shipped asset. Anything whose provenance cannot be
established is replaced, not shipped.

**[PLANNED] Do not shrink the repository by rewriting git history.** The oversized blobs
are already in the commit graph, so deleting them from `HEAD` would not reduce clone size —
only a rewrite would, and that would destroy the history this project is built around and
invalidate `97807ed`. ~12 MB is a non-issue for a portfolio repository. Accept it.

---

## 19. Roadmap

P0–P3 are **[VERIFIED] complete**. Everything from P4 onwards is [PLANNED] and not built.

| Phase                      | Work                                                                                                           | Risk                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------ |
| ~~P0 — Preservation~~      | ~~Tag `v1.0-python`, move to `legacy/python/`~~ **done**                                                       | —                        |
| ~~P1 — Foundation~~        | ~~Vite/TS/ESLint/Prettier/Vitest, minimal Phaser app, CI + Pages workflows~~ **done**                          | —                        |
| ~~P2 — Pure logic~~        | ~~`systems/` + `services/` + `config/`, fully unit-tested, no Phaser imports~~ **done**                        | —                        |
| ~~P3 — Playable grey-box~~ | ~~`GameScene`, `Turtle`, HUD, pause, game over, replay, wired to P2~~ **done in code, browser QA outstanding** | —                        |
| **P4 — Game feel**         | Tweens on spawn and catch, particles, floating score, combo feedback, audio service                            | Low — additive           |
| **P5 — Shell**             | Settings screen, How to Play, mute/volume wired to `StorageService`                                            | Low                      |
| **P6 — Art & QA**          | Licensed artwork, real-device mobile testing, performance, balance tuning with real data                       | Medium — asset-dependent |
| **P7 — Release**           | README with live demo link + GIF, CHANGELOG, version tag                                                       | Low                      |

### P2 outcome [VERIFIED]

Built and documented in §10–§14: `config/balance.ts`, `config/turtleTypes.ts`,
`systems/random.ts`, `systems/scoring.ts`, `systems/difficulty.ts`, `systems/spawn.ts`,
`services/StorageService.ts`. All pure, all unit-tested, none importing Phaser.

### P3 outcome [VERIFIED]

Built and documented in §7. The full core loop exists: Menu → Play → 60-second round →
spawning driven by the difficulty curve → catching, missing, escaping → combo and score →
Golden turtles from the ramped weights → round ends once → Game Over summary → Replay or
Menu, with a pause overlay and a persisted best score.

New files: `scenes/GameScene.ts`, `scenes/PauseScene.ts`, `scenes/GameOverScene.ts`,
`entities/Turtle.ts`, `ui/theme.ts`, `ui/Button.ts`, `ui/Hud.ts`, `utils/phaserRandom.ts`.
Changed: `config/balance.ts` (+ `targetBaseRadiusPx`, `firstSpawnDelayMs`),
`config/gameConfig.ts` (scene registration), `scenes/MenuScene.ts`,
`services/StorageService.ts` (+ `getStorageService()`), and their tests.

**No P2 logic was reimplemented in a scene.** Scoring, combo, accuracy, difficulty
interpolation, weighted selection, placement and the high-score rule are all consumed, not
copied.

**Outstanding for P3: browser QA.** See §6 for the checklist. The code is complete; nobody
has watched it run.

### Game-state ownership [VERIFIED]

| State                                         | Owner                                 | Persisted |
| --------------------------------------------- | ------------------------------------- | --------- |
| score, combo, maxCombo, hits, misses, spawned | `RoundState` via `systems/scoring.ts` | no        |
| accuracy                                      | _derived_, never stored               | no        |
| elapsed/remaining, round status               | `GameScene`                           | no        |
| difficulty parameters                         | _derived_ from elapsed time           | no        |
| turtle sprites, positions, expiry timers      | Phaser display list + scene Clock     | no        |
| which screen is active                        | **Phaser SceneManager**               | no        |
| highScore, settings                           | `StorageService`                      | **yes**   |

**Scene-to-scene data passes as typed init payloads** (`this.scene.start('GameOver', result)`),
never a module-level global.

### P4 scope [PLANNED]

Nothing below exists. P3 stopped deliberately short of all of it.

- Spawn and catch tweens, a catch particle burst, floating "+30" score text.
- Visible combo-tier feedback (the HUD currently just prints the multiplier).
- An audio service: catch, miss and round-end sounds, wired to the existing
  `settings.muted` / `settings.volume` that `StorageService` already persists but that
  nothing yet reads.
- A countdown emphasis in the closing seconds.

Final art, atlases, music, screen shake, custom logo and the release README remain
[PLANNED] for P6/P7 and must not be pulled forward.

### [IDEA] — not approved, do not build

Fast / Small turtle variants · power-ups · moving (non-teleporting) turtles · achievements ·
lifetime statistics dashboard · Endless and Time Attack modes · online leaderboards
(**would require a backend — conflicts with the static-site constraint**) · background
music · fullscreen toggle · localisation · PWA/offline · screen shake · daily challenge.

---

## 20. Development principles [PLANNED]

- **Logic worth testing must not import Phaser.** This is the most important structural
  rule; it is exactly what the legacy version got wrong.
- Every tuning number lives in `config/balance.ts` with a name that explains it.
- Prefer plain functions and small classes over patterns this game does not need. No
  abstraction without a second concrete use case.
- `strict: true`, no `any`, explicit types on exported functions.
- Create a directory when the code that fills it arrives, not in anticipation.
- Match surrounding style when editing; reformat only files you are already changing.

---

## 21. Rules Claude must follow in this repository

1. **Understand existing behaviour before changing it.** For timing, rendering or
   deployment, verify by running rather than assuming.
2. **Do not introduce unnecessary frameworks or dependencies.** The §2 table is the
   approved set. No React, no state-management library, no physics engine, no animation
   library (Phaser has tweens). Anything else needs an explicit reason and the owner's
   approval.
3. **Follow Phaser 4 documentation, not Phaser 3 habits.** `node_modules/phaser/skills/`
   is the authoritative in-repo reference.
4. **Pin direct dependencies exactly.** No `^` or `~` in `package.json`.
5. **Never modify anything under `legacy/python/`.** It is a historical artifact: no bug
   fixes, no reformatting, no resized images, no path rewrites. It is excluded from ESLint
   and Prettier for this reason.
6. **Never silently remove functionality.** If something must be dropped or replaced, say
   so explicitly and explain why.
7. **Keep gameplay logic separated from presentation.** `src/systems/**` and
   `src/services/**` must never import Phaser, touch the DOM, or read browser globals
   (`StorageService` reaches storage only through its injected `StorageLike`). Scenes must
   not embed game rules. This boundary is what makes the suite in §9 possible — verify it
   still holds after any change.
8. **Never call `Math.random()` in gameplay code.** Randomness is injected as a
   `RandomSource` (§13), or spawn behaviour stops being testable.
9. **Every gameplay number belongs in `config/balance.ts`**, with a name that explains it.
10. **Every runtime URL must resolve through the deployment base** (§5). This is the one
    mistake that breaks the live site while working perfectly locally.
11. **Avoid overengineering.** This is a small arcade game; solutions stay proportional.
12. **Do not change GitHub repository settings from the CLI or API.** Enabling Pages is the
    owner's manual step. Never set `enablement: true` on `configure-pages`.
13. **Do not rewrite git history.** No `filter-repo`, no force-push, no rebasing published
    commits. The history is the point of this project.
14. **Do not commit, push, or push tags unless asked.**
15. **Ship only assets we have the right to distribute publicly.**
16. **Add or update tests when introducing testable logic**, and update documentation —
    README and this file — in the same change that alters behaviour.
17. **Keep this file honest.** Tag every statement `[VERIFIED]`, `[LEGACY]`, `[PLANNED]` or
    `[IDEA]` correctly, and never let it drift ahead of what actually exists.
