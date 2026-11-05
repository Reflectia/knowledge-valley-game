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
from build_buildings import background, cut, defringe  # noqa: E402
from pixelize import assign, drop_specks, grid_phase, kmeans_colors, majority_downscale, to_image  # noqa: E402

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


# Simpler furniture (images/interior/interior-objects-simple-new.jpg), drawn on a coarse grid of
# SIMPLE_PERIOD source px per art pixel at about game size: sampled one cell = one game pixel.
# It replaces the detailed sprites of the same name (the simple sheet has no chest).
SIMPLE_PERIOD = 20.4
SIMPLE: dict[str, tuple[int, int, int, int]] = {
    "bed": (95, 50, 585, 765),
    "desk": (730, 130, 1312, 755),
    "bookshelf": (1445, 50, 1975, 728),
    "fireplace": (72, 808, 622, 1465),
    "rug": (755, 878, 1312, 1428),
    "doormat": (1402, 1150, 1852, 1465),  # the lower of the two mats
    "fern": (72, 1625, 395, 2020),
    "palm": (438, 1520, 755, 2025),
    "lamp": (808, 1525, 978, 2025),
    "table": (1032, 1636, 1688, 2032),
    "clock": (1730, 1594, 1980, 2036),
}


def native(src: np.ndarray, box: tuple[int, int, int, int], period: float) -> Image.Image:
    """Sample a sprite drawn on a coarse pixel grid back to one pixel per cell."""
    rgb, fg = cut(src, box)
    gray = rgb.astype(np.float64).mean(2)
    ox, oy = grid_phase(gray, period, 1), grid_phase(gray, period, 0)
    nx = int(np.ceil((rgb.shape[1] - ox) / period)) + 1
    ny = int(np.ceil((rgb.shape[0] - oy) / period)) + 1
    xs = np.clip((ox - period + np.arange(nx + 1) * period).round().astype(int), 0, rgb.shape[1])
    ys = np.clip((oy - period + np.arange(ny + 1) * period).round().astype(int), 0, rgb.shape[0])
    cells = np.zeros((ny, nx, 3))
    opaque = np.zeros((ny, nx), dtype=bool)
    for j in range(ny):
        for i in range(nx):
            y0, y1, x0, x1 = ys[j], ys[j + 1], xs[i], xs[i + 1]
            if y1 - y0 < 2 or x1 - x0 < 2:
                continue
            m = max(1, (y1 - y0) // 4), max(1, (x1 - x0) // 4)
            core = (slice(y0 + m[0], max(y0 + m[0] + 1, y1 - m[0])), slice(x0 + m[1], max(x0 + m[1] + 1, x1 - m[1])))
            f = fg[core]
            if f.mean() < 0.5:
                continue
            opaque[j, i] = True
            cells[j, i] = np.median(rgb[core][f], 0)
    palette = kmeans_colors(cells[opaque], 12)
    idx = np.full(opaque.shape, -1, dtype=np.int32)
    idx[opaque] = assign(cells[opaque], palette)
    # Dark magenta (the sheet's shadows under objects): red and blue with almost no green.
    shade = (palette[:, 1] < 0.25 * np.minimum(palette[:, 0], palette[:, 2])) & (np.minimum(palette[:, 0], palette[:, 2]) > 40)
    idx[(idx >= 0) & shade[np.maximum(idx, 0)]] = -1
    im = to_image(drop_specks(defringe(idx, palette), 2), palette)
    return im.crop(im.getbbox())


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


DETAILED = {"bookshelf", "desk", "clock"}


def calm_sprite(idx: np.ndarray, passes: int = 2) -> np.ndarray:
    """Like `calm`, for sprites: a lone opaque pixel takes its commonest opaque neighbour.
    Transparency is never changed, so outlines and the silhouette stay."""
    for _ in range(passes):
        p = np.pad(idx, 1, constant_values=-1)
        nb = np.stack([p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]])
        out = idx.copy()
        for y, x in zip(*np.nonzero((idx >= 0) & (nb != idx).all(0))):
            v = nb[:, y, x]
            v = v[v >= 0]
            if v.size:
                vals, counts = np.unique(v, return_counts=True)
                out[y, x] = vals[counts.argmax()]
        idx = out
    return idx


def objects() -> dict[str, Image.Image]:
    sheet = Image.open(SRC / "interior-objects-new.jpg").convert("RGB")
    src = np.asarray(sheet)
    # Smoothed copy for the colors (the shapes come from the sharp sheet). Small-detail
    # objects (book spines, the journal, clock hands) stay sharp: smoothing erases them.
    smooth = np.asarray(sheet.filter(ImageFilter.MedianFilter(7)))
    out = {}
    for name, (box, (mw, mh)) in OBJECTS.items():
        rgb, fg = cut(src, box)
        l, t = box[0], box[1]
        # `cut` trims to the object: find the same window in the smoothed copy.
        full = ~background(src[t : box[3], l : box[2]])
        y0 = np.nonzero(full.sum(1) >= 3)[0].min()
        x0 = np.nonzero(full.sum(0) >= 3)[0].min()
        sharp = name in DETAILED
        if not sharp:
            rgb = smooth[t + y0 : t + y0 + fg.shape[0], l + x0 : l + x0 + fg.shape[1]]
        h, w = fg.shape
        scale = max(w / mw, h / mh)
        size = (max(1, round(w / scale)), max(1, round(h / scale)))
        palette = kmeans_colors(rgb[fg], 24 if sharp else 12)
        labels = np.zeros(fg.shape, dtype=np.int32)
        labels[fg] = assign(rgb[fg], palette)
        idx = majority_downscale(labels, fg, size[0], size[1], 0.5, palette, 2.0 if sharp else 1.6)
        idx = drop_specks(defringe(idx, palette), 2)
        if not sharp:
            idx = calm_sprite(idx)
        im = to_image(idx, palette)
        out[name] = im.crop(im.getbbox())
    return out


def simple() -> dict[str, Image.Image]:
    src = np.asarray(Image.open(SRC / "interior-objects-simple-new.jpg").convert("RGB"))
    return {name: native(src, box, SIMPLE_PERIOD) for name, box in SIMPLE.items()}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    tiles = surfaces()
    tiles.save(OUT / "interior-tiles.png")
    print(f"  interior/interior-tiles.png  {tiles.width}x{tiles.height}")
    for name, im in {**objects(), **simple()}.items():
        im.save(OUT / f"{name}.png")
        print(f"  interior/{name}.png  {im.width}x{im.height}")


if __name__ == "__main__":
    main()
