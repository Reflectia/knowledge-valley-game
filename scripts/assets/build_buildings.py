"""Discipline buildings (5 levels each) from the owner's sheets in images/buildings/.

Run from the repo root:  python scripts/assets/build_buildings.py [pack ...]
Outputs public/assets/buildings/<pack>-<level>.png (level 1..5), bottom-aligned,
tight around the building, magenta background removed.

One scale per building, set so that level 5 fits LEVEL5_WIDTH × LEVEL5_HEIGHT; the lower
levels use the same scale, so they grow visibly. Boxes are source pixels.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
from pixelize import _reach, assign, drop_specks, kmeans_colors, majority_downscale, to_image  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "images/buildings"
OUT = ROOT / "public/assets/buildings"

# A plot is 5×5 tiles (80 px); level 5 may overhang it by 4 px on each side,
# and stays under 9 tiles tall so it does not cover the road above the plots.
LEVEL5_WIDTH = 88
LEVEL5_HEIGHT = 144

# Per pack: level boxes (left, top, right, bottom) and areas to blank before cutting
# (stray scenery on the sheet). Sheets with several variants of a level: the
# chosen one is listed; see ASSETS-TODO.md.
SHEETS: dict[str, dict] = {
    "forest": {
        "levels": [
            (80, 340, 650, 760),  # construction site
            (740, 205, 1195, 720),  # wooden hut with glass
            (1315, 110, 1860, 725),  # glass house with lanterns
            (1030, 780, 1890, 1390),  # glass house with an extension and banners
            (1915, 70, 2745, 1390),  # glass dome with the giant sprout
        ],
    },
    "market": {
        # The sheet has a thin ground line at y≈809: boxes stop above it.
        "levels": [
            (45, 560, 690, 806),
            (735, 440, 1160, 806),
            (1195, 420, 1712, 806),
            (1765, 290, 2385, 806),
            (2440, 40, 3135, 806),
        ],
    },
    "library": {
        "blank": [(1320, 590, 1640, 692)],  # a cloud between levels 3 and 4
        "levels": [
            (45, 1170, 595, 1434),  # lower variant of the site
            (622, 980, 995, 1434),  # stone hut (the lower variant of level 2)
            (1025, 690, 1525, 1434),
            (1560, 420, 2048, 1434),
            (2055, 95, 2712, 1434),
        ],
    },
}


def grow(seed: np.ndarray, cand: np.ndarray) -> np.ndarray:
    """Grow the seed inside the candidates (4-neighborhood)."""
    reach = seed & cand
    while True:
        grown = reach.copy()
        grown[1:] |= reach[:-1]
        grown[:-1] |= reach[1:]
        grown[:, 1:] |= reach[:, :-1]
        grown[:, :-1] |= reach[:, 1:]
        grown &= cand
        if (grown == reach).all():
            return reach
        reach = grown


def background(rgb: np.ndarray) -> np.ndarray:
    """Magenta and its JPEG fringe: connected to the crop border, or enclosed
    areas big enough not to be a pink detail (potions, flowers)."""
    px = rgb.astype(np.int32)
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    magenta = (r > 120) & (b > 100) & (g < 0.75 * np.minimum(r, b)) & (r - g > 70) & (b - g > 50)
    # Cores of large magenta areas survive a 6 px erosion; small details do not.
    core = np.asarray(Image.fromarray((magenta * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(13))) > 0
    return _reach(magenta) | grow(core, magenta)


def cut(src: np.ndarray, box: tuple[int, int, int, int]) -> tuple[np.ndarray, np.ndarray]:
    l, t, r, b = box
    crop = src[t:b, l:r]
    fg = ~background(crop)
    rows = np.nonzero(fg.sum(1) >= 3)[0]
    cols = np.nonzero(fg.sum(0) >= 3)[0]
    y0, y1, x0, x1 = rows.min(), rows.max() + 1, cols.min(), cols.max() + 1
    return crop[y0:y1, x0:x1], fg[y0:y1, x0:x1]


def defringe(idx: np.ndarray, palette: np.ndarray) -> np.ndarray:
    """Magenta-tinted pixels on the outer edge (JPEG bleed) become transparent."""
    p = palette
    pink = (p[:, 0] > 140) & (p[:, 2] > 110) & (p[:, 1] < 0.65 * np.minimum(p[:, 0], p[:, 2]))
    out = idx.copy()
    for _ in range(2):
        clear = np.pad(out < 0, 1, constant_values=True)
        near = clear[:-2, 1:-1] | clear[2:, 1:-1] | clear[1:-1, :-2] | clear[1:-1, 2:]
        out[(out >= 0) & near & pink[np.maximum(out, 0)]] = -1
    return out


def build(pack: str) -> None:
    sheet = SHEETS[pack]
    src = np.asarray(Image.open(SRC / f"building-{pack}-new.jpg").convert("RGB")).copy()
    for l, t, r, b in sheet.get("blank", []):
        src[t:b, l:r] = (255, 0, 255)
    figures = [cut(src, box) for box in sheet["levels"]]
    h5, w5 = figures[-1][1].shape
    scale = max(w5 / LEVEL5_WIDTH, h5 / LEVEL5_HEIGHT)
    palette = kmeans_colors(np.concatenate([rgb[fg] for rgb, fg in figures]), 40)
    for level, (rgb, fg) in enumerate(figures, start=1):
        labels = np.zeros(fg.shape, dtype=np.int32)
        labels[fg] = assign(rgb[fg], palette)
        h, w = fg.shape
        idx = majority_downscale(labels, fg, max(1, round(w / scale)), max(1, round(h / scale)), 0.5, palette, 2.0)
        idx = defringe(idx, palette)
        idx = drop_specks(idx, 4)
        im = to_image(idx, palette)
        im = im.crop(im.getbbox())
        OUT.mkdir(parents=True, exist_ok=True)
        im.save(OUT / f"{pack}-{level}.png")
        print(f"  buildings/{pack}-{level}.png  {im.width}x{im.height}")


def main() -> None:
    packs = sys.argv[1:] or list(SHEETS)
    for pack in packs:
        print(pack)
        build(pack)


if __name__ == "__main__":
    main()
