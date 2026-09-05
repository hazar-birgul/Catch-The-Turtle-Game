# Catch the Turtle — original Python version (2025)

This is the **original implementation** of Catch the Turtle, written in Python with
`tkinter` and the standard-library `turtle` module.

It was created as an early Python learning project — one of the author's first
software projects.

It is preserved here **for project history**. It is no longer the actively developed
version, and it is kept unmodified: its bugs, structure, assets and code style are
left exactly as they were.

The actively developed **modern browser version lives at the repository root**.

## History

- Original commit: `97807ed` — "version 1.0 added" (2025-05-16)
- Tagged as: `v1.0-python`

## Running it

Requires Python 3 on Windows (it uses the Windows-only `winsound` module), and must be
run from this directory because some assets are loaded via relative paths.

```bash
pip install pillow
python main.py
```

## Files

| File | Purpose |
|---|---|
| `main.py` | The entire game — 241 lines |
| `click.wav` | Sound played on a successful catch |
| `image_2.png` | Menu screen graphic |
| `image.png` | Game-over screen graphic |
| `time_end.png` | "Time's up" graphic, rotated for the transition animation |
| `sound_on.png` / `sound_off.png` | Mute toggle icons |
| `image.jpg` | Unused by the code; kept as part of the original repository contents |
| `.idea/` | The original PyCharm project files |

**Note on assets:** the provenance of these images and the sound file is not
documented, so they are treated as historical material only. They are **not** used by
the modern browser version and are not redistributed as part of it.
