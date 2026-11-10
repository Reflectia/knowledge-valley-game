"""Biome tilesets from the owner's new biome sheets.

Source: images/previews/Biomes/<biome>-palette-tiles-stages-new.jpg. Each sheet has three rows:
palette swatches, four sample tiles (ground, path, special surface, prop on the ground), and five
revival stages. Only the sample tiles are used: revival stages are a filter in the game.

Output: public/assets/tiles/<biome>-tileset-16.png, 80x16, same layout as the design-system
tilesets: 0 ground, 1 path, 2 special surface, 3 prop on the ground, 4 the prop on transparency.

- Ground, path and special surface are drawn on a 16x16 art grid: each cell takes the median color
  of its inner area.
- Props are drawn at ~32x32 detail on the sheets, so a plain downscale smears them. They are
  redrawn by hand at 16x16 (PROPS below) after the sheet, except the forest tree, which is already
  drawn on a 16x16 grid and is sampled like the surfaces.
- The transparent prop drops the background: for hand-drawn props the characters listed in
  `bg`, for the forest tree the grass connected to the tile border.

Run from the repo root: python scripts/assets/build_biome_tiles.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "images" / "previews" / "Biomes"
OUT = ROOT / "public" / "assets" / "tiles"
BIOMES = ["forest", "tower", "market", "forge", "library"]


def runs(v, minlen=5):
    out, start = [], None
    for i, x in enumerate(v):
        if x and start is None:
            start = i
        if not x and start is not None:
            if i - start >= minlen:
                out.append((start, i - 1))
            start = None
    if start is not None and len(v) - start >= minlen:
        out.append((start, len(v) - 1))
    return out


def merge(rs, gap=40):
    """Join runs split by dark pixels inside a tile."""
    out = []
    for a, b in rs:
        if out and a - out[-1][1] < gap:
            out[-1] = (out[-1][0], b)
        else:
            out.append((a, b))
    return out


def sample_grid(region, n):
    """Each of n*n cells -> median color of its inner half (skips JPEG fringes at cell edges)."""
    h, w, _ = region.shape
    cw, ch = w / n, h / n
    out = np.zeros((n, n, 3), np.uint8)
    for j in range(n):
        for i in range(n):
            x0, x1 = int(i * cw + cw * 0.25), int((i + 1) * cw - cw * 0.25)
            y0, y1 = int(j * ch + ch * 0.25), int((j + 1) * ch - ch * 0.25)
            cell = region[y0:max(y1, y0 + 1), x0:max(x1, x0 + 1)].reshape(-1, 3)
            out[j, i] = np.median(cell, axis=0)
    return out


def sample_tiles(biome):
    """The four sample tiles of a sheet (second row), found by their dark gaps."""
    im = np.asarray(Image.open(SRC / f"{biome}-palette-tiles-stages-new.jpg").convert("RGB")).astype(int)
    bg = im[400, 2000]  # sheet background between the tiles
    content = np.abs(im - bg).sum(axis=2) > 40
    row = next(r for r in runs(content.any(axis=1), 20) if 200 < r[0] < 700 and r[1] - r[0] < 400)
    cols = merge(runs(content[row[0]:row[1] + 1].any(axis=0)))
    assert len(cols) == 4, (biome, cols)
    return [sample_grid(im[row[0]:row[1] + 1, x0:x1 + 1].astype(np.uint8), 16) for x0, x1 in cols]


# Hand-drawn props (16x16). `bg` = characters that become transparent in the standalone prop.
PROPS = {
    # anvil on a wooden block, on the stone floor
    "forge": {
        "bg": ".sl",
        "pal": {
            '.': (182, 166, 150), 's': (132, 120, 112), 'l': (214, 204, 188), 'O': (36, 26, 26),
            'H': (168, 168, 178), 'A': (104, 102, 112), 'D': (66, 62, 72),
            'w': (164, 104, 62), 'W': (124, 74, 46), 'd': (82, 46, 32),
        },
        "rows": [
            "..s.......l...s.",
            ".sls.....sls....",
            "..s.......s.....",
            "...OOOOOOOOOOO..",
            "OOOHHHHHHHHHHHO.",
            ".ODDAAAAAAAAADO.",
            "..OOODAAAAADOO..",
            ".....ODAAADO....",
            "....ODAAAAADO...",
            "..OOOOOOOOOOOOO.",
            "..OwwwwwwwwwwwO.",
            "..OWWWdWWWdWWWO.",
            "..OWWWdWWWdWWWO.",
            "..OdddddddddddO.",
            "...OOOOOOOOOOO..",
            ".s.....l.....s..",
        ],
    },
    # stack of books with a candle, on olive moss with fallen leaves
    "library": {
        "bg": ".kyo",
        "pal": {
            '.': (112, 104, 58), 'k': (88, 82, 44), 'y': (222, 168, 56), 'o': (196, 112, 44),
            'O': (38, 28, 30), 'Y': (252, 226, 120), 'F': (236, 140, 48), 'C': (232, 222, 196),
            'q': (150, 98, 66), 'p': (112, 88, 124), 'P': (74, 54, 86), 'w': (232, 220, 186),
            'R': (156, 62, 46), 'r': (112, 40, 34), 'G': (164, 172, 104), 'g': (118, 128, 72),
            'd': (120, 70, 44),
        },
        "rows": [
            "..o....Y.....k..",
            ".......F...y....",
            ".k....OCO......o",
            "......OCO..qq...",
            "..y...OCO..q....",
            "..OOOOOOOOOOOO..",
            "..OppppppppppO..",
            "..OPPPPPPPPPwO..",
            ".OOOOOOOOOOOOOO.",
            ".ORRRRRRRRRRRwO.",
            ".OrrrrrrrrrrrwO.",
            ".OOOOOOOOOOOOOO.",
            ".OGGGGGGGGGGGwO.",
            ".OgggggggggggwO.",
            ".OOOOOOOOOOOOOO.",
            "..k.dd....dd..y.",
        ],
    },
    # wooden crate of red apples, in grass
    "market": {
        "bg": ".lL",
        "pal": {
            '.': (98, 160, 58), 'l': (150, 204, 82), 'L': (58, 112, 40), 'v': (40, 96, 36),
            'O': (40, 24, 20), 'A': (214, 52, 40), 'h': (255, 150, 120), 'a': (150, 30, 28),
            'w': (164, 108, 64), 'W': (130, 82, 48), 'd': (88, 52, 32),
        },
        "rows": [
            ".l.....l.....l..",
            "....v.....v.....",
            "...OOO.OOO.OOO..",
            "..OAhAOAhAOAhAO.",
            "..OAAAOAAAOAAAO.",
            "..OaaaaaaaaaaaO.",
            ".OOOOOOOOOOOOOO.",
            ".OdwwwwwwwwwwdO.",
            ".OdWWWWWWWWWWdO.",
            ".OddddddddddddO.",
            ".OdwwwwwwwwwwdO.",
            ".OdWWWWWWWWWWdO.",
            ".OddddddddddddO.",
            ".OdWWWWWWWWWWdO.",
            ".OOOOOOOOOOOOOO.",
            ".l.L.lL..L.l.lL.",
        ],
    },
    # three amethyst crystals in snow under a starry night sky
    "tower": {
        "bg": ".*Ss",
        "pal": {
            '.': (40, 46, 92), '*': (226, 206, 255), 'O': (42, 26, 64), 'L': (222, 192, 252),
            'M': (164, 112, 222), 'D': (104, 62, 164), 'S': (226, 236, 250), 's': (172, 190, 230),
        },
        "rows": [
            "..........*.....",
            ".......OO.......",
            "..*...OLMO......",
            "......OLMO...*..",
            "......OLMO..OO..",
            "......OLMO.OLMO.",
            ".OO...OLMO.OLMO.",
            "OLMO..OLMO.OLMO.",
            "OLMO..OLDO.OLDO.",
            "OLDO..OLDO.OLDO.",
            "OLDO..OLDO.OLDO.",
            "OLDOsSOLDOSOLDOs",
            "sSSSSsSSSSSsSSSS",
            "SSsSSSSSsSSSSsSS",
            "SSSSsSSSSSSsSSSS",
            "sSSSSSSsSSSSSSSs",
        ],
    },
}


def hand_prop(spec):
    rows, pal, bg = spec["rows"], spec["pal"], spec["bg"]
    assert len(rows) == 16 and all(len(r) == 16 for r in rows)
    rgba = np.array([[(*pal[c], 255) for c in r] for r in rows], np.uint8)
    alone = rgba.copy()
    alone[np.array([[c in bg for c in r] for r in rows])] = 0
    return rgba, alone


def key_out_grass(tile):
    """Transparent copy of a prop on grass: drop green pixels connected to the border."""
    rgb = tile.astype(int)
    green = (rgb[..., 1] > rgb[..., 0] + 10) & (rgb[..., 1] >= rgb[..., 2])
    drop = np.zeros(green.shape, bool)
    stack = [(y, x) for y in range(16) for x in range(16) if (y in (0, 15) or x in (0, 15)) and green[y, x]]
    while stack:
        y, x = stack.pop()
        if drop[y, x]:
            continue
        drop[y, x] = True
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < 16 and 0 <= nx < 16 and green[ny, nx] and not drop[ny, nx]:
                stack.append((ny, nx))
    alone = np.dstack([tile, np.full((16, 16), 255, np.uint8)])
    alone[drop] = 0
    return alone


def build(biome):
    ground, path, special, prop = sample_tiles(biome)
    opaque = lambda t: np.dstack([t, np.full((16, 16), 255, np.uint8)])
    if biome in PROPS:
        prop_rgba, alone = hand_prop(PROPS[biome])
    else:
        prop_rgba, alone = opaque(prop), key_out_grass(prop)
    sheet = np.concatenate([opaque(ground), opaque(path), opaque(special), prop_rgba, alone], axis=1)
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(sheet, "RGBA").save(OUT / f"{biome}-tileset-16.png")
    print(f"{biome}: {OUT / f'{biome}-tileset-16.png'}")


if __name__ == "__main__":
    for b in BIOMES:
        build(b)
