"""House interior from the owner's sheets in images/interior/.

Run from the repo root:  python scripts/assets/build_interior.py
Outputs public/assets/interior/:
- interior-tiles.png  16×16 tileset, 8 columns:
    0–15  floor, a 4×4-tile seamless patch (row-major: tile = (y % 4) * 4 + x % 4)
    16–23 log wall, 4 tiles wide × 2 tall (top row 16–19, bottom row with the baseboard 20–23)
    24–27 wall with the window (2×2: 24 25 / 26 27)
    28–31 wall with the herb shelf (2×2: 28 29 / 30 31)
- <object>.png        furniture sprites at game size, bottom-aligned, magenta removed

Tile indices are mirrored in scripts/maps/build-maps.mjs (house()).
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
from build_buildings import cut, defringe  # noqa: E402
from pixelize import assign, drop_specks, kmeans_colors, majority_downscale, to_image  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "images/interior"
OUT = ROOT / "public/assets/interior"
T = 16

# Surfaces sheet (source px, inset from the magenta separators): box → size in game px, colors.
# The floor uses 8 planks of the patch (gap to gap, x 70–579), so a plank is 8 px wide and the
# tile wraps on a plank gap; the whole patch would give 4 px planks that read as noise.
SURFACES = [
    ("floor", (70, 260, 579, 769), (64, 64), 5),
    ("wall", (1037, 13, 2035, 505), (64, 32), 6),
    ("window", (1037, 526, 1523, 1017), (32, 32), 8),
    ("shelf", (1549, 526, 2035, 1017), (32, 32), 8),
]

# Objects sheet: name → (box in source px, max size in game px). Aspect is kept.
OBJECTS: dict[str, tuple[tuple[int, int, int, int], tuple[int, int]]] = {
    "bed": ((30, 25, 530, 765), (24, 36)),
    "desk": ((680, 70, 1210, 715), (32, 30)),  # with the journal, quill, candle and chair
    "bookshelf": ((1250, 35, 1655, 690), (20, 32)),
    "chest": ((1700, 50, 2015, 355), (16, 16)),  # the upper of the two chests
    "fireplace": ((40, 820, 545, 1470), (32, 40)),
    "rug": ((630, 835, 1215, 1370), (32, 32)),
    "doormat": ((1280, 1112, 1725, 1380), (32, 18)),  # the front mat (the back one is cut by it)
    "fern": ((45, 1635, 365, 1955), (16, 16)),
    "palm": ((380, 1505, 700, 1960), (16, 24)),
    "lamp": ((755, 1435, 985, 1950), (14, 32)),
    "table": ((1040, 1625, 1700, 1990), (40, 24)),  # round table with two stools
    "clock": ((1735, 1480, 1995, 1965), (14, 26)),
}


def calm(idx: np.ndarray, passes: int = 2) -> np.ndarray:
    """Pixels unlike all 4 neighbours (wrapping, as tiles repeat) take the commonest neighbour."""
    for _ in range(passes):
        p = np.pad(idx, 1, mode="wrap")
        nb = np.stack([p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]])
        out = idx.copy()
        for y, x in zip(*np.nonzero((nb != idx).all(0))):
            v, c = np.unique(nb[:, y, x], return_counts=True)
            out[y, x] = v[c.argmax()]
        idx = out
    return idx


def surface(crop: Image.Image, size: tuple[int, int], colors: int) -> Image.Image:
    """Smooth, average down to the game size, then a few flat colors: calm, readable tiles."""
    small = np.asarray(crop.filter(ImageFilter.MedianFilter(9)).resize(size, Image.BOX)).reshape(-1, 3).astype(np.float64)
    palette = kmeans_colors(small, colors)
    idx = calm(assign(small, palette).reshape(size[1], size[0]))
    rgba = np.full((size[1], size[0], 4), 255, dtype=np.uint8)
    rgba[..., :3] = palette[idx].round().astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def surfaces() -> Image.Image:
    src = Image.open(SRC / "interior-surfaces-new.jpg").convert("RGB")
    tiles = Image.new("RGBA", (8 * T, 4 * T))
    parts = {name: surface(src.crop(box), size, colors) for name, box, size, colors in SURFACES}
    # Floor 0–15: rows 0–1 of the sheet; wall 16–23: row 2; window and shelf 24–31: row 3.
    floor = parts["floor"]
    for i in range(16):
        x, y = i % 4, i // 4
        tiles.paste(floor.crop((x * T, y * T, x * T + T, y * T + T)), ((i % 8) * T, (i // 8) * T))
    for i, (name, w) in enumerate([("wall", 4), ("window", 2), ("shelf", 2)]):
        part = parts[name]
        base = 16 + [0, 8, 12][i]
        for k in range(w * 2):
            x, y = k % w, k // w
            n = base + k
            tiles.paste(part.crop((x * T, y * T, x * T + T, y * T + T)), ((n % 8) * T, (n // 8) * T))
    return tiles


def objects() -> dict[str, Image.Image]:
    src = np.asarray(Image.open(SRC / "interior-objects-new.jpg").convert("RGB"))
    out = {}
    for name, (box, (mw, mh)) in OBJECTS.items():
        rgb, fg = cut(src, box)
        h, w = fg.shape
        scale = max(w / mw, h / mh)
        size = (max(1, round(w / scale)), max(1, round(h / scale)))
        palette = kmeans_colors(rgb[fg], 24)
        labels = np.zeros(fg.shape, dtype=np.int32)
        labels[fg] = assign(rgb[fg], palette)
        idx = majority_downscale(labels, fg, size[0], size[1], 0.5, palette, 2.0)
        idx = drop_specks(defringe(idx, palette), 2)
        im = to_image(idx, palette)
        out[name] = im.crop(im.getbbox())
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    tiles = surfaces()
    tiles.save(OUT / "interior-tiles.png")
    print(f"  interior/interior-tiles.png  {tiles.width}x{tiles.height}")
    for name, im in objects().items():
        im.save(OUT / f"{name}.png")
        print(f"  interior/{name}.png  {im.width}x{im.height}")


if __name__ == "__main__":
    main()
