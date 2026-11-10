"""Exam bosses 32x32 and trophies 16x16 from the owner's Gemini sheets (stage 11).

Sources (prompt: docs/gemini-prompt-bosses.md), figures on magenta, in pack order
forest, tower, market, forge, library:
- images/enemies/bosses-new.jfif: two rows, two variants of every boss; ROW picks one per boss;
- images/items/trophies-new.jfif: one row; each trophy sits on a darker magenta card.

Figures are found by the magenta background, cut the same way as the buildings
(build_buildings.py), scaled to fit the target box (one scale per figure, whole sprite visible)
and bottom-centred on a transparent canvas.

Run from the repo root:
    python scripts/assets/build_bosses.py                 -> public/assets/bosses/<pack>.png,
                                                             public/assets/items/trophy-<pack>.png
    python scripts/assets/build_bosses.py --review DIR    -> the same into DIR, plus a contact sheet
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from build_buildings import background, defringe  # noqa: E402
from pixelize import assign, drop_specks, kmeans_colors, majority_downscale, to_image  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
PACKS = ["forest", "tower", "market", "forge", "library"]

BOSSES_SRC = ROOT / "images/enemies/bosses-new.jfif"
TROPHIES_SRC = ROOT / "images/items/trophies-new.jfif"

# Which variant of each boss: 0 = top row, 1 = bottom row of the sheet.
ROW = {"forest": 0, "tower": 0, "market": 0, "forge": 0, "library": 0}


def runs(mask_1d: np.ndarray, min_gap: int, min_len: int) -> list[tuple[int, int]]:
    """Stretches where the projection is on, joined across gaps shorter than min_gap."""
    on = np.nonzero(mask_1d)[0]
    if len(on) == 0:
        return []
    out = [[on[0], on[0] + 1]]
    for i in on[1:]:
        if i - out[-1][1] < min_gap:
            out[-1][1] = i + 1
        else:
            out.append([i, i + 1])
    return [(a, b) for a, b in out if b - a >= min_len]


def figures(src: np.ndarray, rows: int) -> list[list[tuple[int, int, int, int]]]:
    """Boxes of the figures on a sheet: `rows` rows, figures split by empty columns."""
    fg = ~background(src)
    row_runs = runs(fg.sum(1) >= 3, 20, 40)
    assert len(row_runs) == rows, f"expected {rows} rows of figures, found {row_runs}"
    out = []
    for t, b in row_runs:
        cols = runs(fg[t:b].sum(0) >= 2, 20, 40)
        assert len(cols) == len(PACKS), f"expected {len(PACKS)} figures in a row, found {cols}"
        out.append([(l, t, r, b) for l, r in cols])
    return out


def sprite(src: np.ndarray, box: tuple[int, int, int, int], size: int, colors: int) -> Image.Image:
    l, t, r, b = box
    crop = src[t:b, l:r]
    fg = ~background(crop)
    ys = np.nonzero(fg.sum(1) >= 2)[0]
    xs = np.nonzero(fg.sum(0) >= 2)[0]
    crop, fg = crop[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1], fg[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    h, w = fg.shape
    scale = max(w, h) / size
    palette = kmeans_colors(crop[fg], colors)
    labels = np.zeros(fg.shape, dtype=np.int32)
    labels[fg] = assign(crop[fg], palette)
    idx = majority_downscale(labels, fg, max(1, round(w / scale)), max(1, round(h / scale)), 0.5, palette, 2.0)
    idx = drop_specks(defringe(idx, palette), 3)
    im = to_image(idx, palette)
    im = im.crop(im.getbbox())
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((size - im.width) // 2, size - im.height))
    return canvas


def build(out_bosses: Path, out_items: Path) -> list[Image.Image]:
    made = []
    src = np.asarray(Image.open(BOSSES_SRC).convert("RGB")).copy()
    grid = figures(src, 2)
    out_bosses.mkdir(parents=True, exist_ok=True)
    for i, pack in enumerate(PACKS):
        im = sprite(src, grid[ROW[pack]][i], 32, 18)
        im.save(out_bosses / f"{pack}.png")
        made.append(im)
    src = np.asarray(Image.open(TROPHIES_SRC).convert("RGB")).copy()
    row = figures(src, 1)[0]
    out_items.mkdir(parents=True, exist_ok=True)
    for i, pack in enumerate(PACKS):
        im = sprite(src, row[i], 16, 10)
        im.save(out_items / f"trophy-{pack}.png")
        made.append(im)
    return made


def contact(images: list[Image.Image], path: Path, s: int = 6) -> None:
    w = sum(im.width + 4 for im in images) * s
    sheet = Image.new("RGBA", (w, 36 * s), (58, 50, 44, 255))
    x = 0
    for im in images:
        sheet.alpha_composite(im.resize((im.width * s, im.height * s), Image.NEAREST), (x + 2 * s, (34 - im.height) * s))
        x += (im.width + 4) * s
    sheet.save(path)
    print("wrote", path)


if __name__ == "__main__":
    if "--review" in sys.argv:
        d = Path(sys.argv[sys.argv.index("--review") + 1])
        contact(build(d / "bosses", d / "items"), d / "bosses-x6.png")
    else:
        build(ROOT / "public/assets/bosses", ROOT / "public/assets/items")
        print("bosses and trophies written")
