"""Build the heroine sprite sheet and recolor palettes.

Source: images/characters/heroine-variants-new.jpg (2 rows × 6 cards of idle poses).
Output:
  public/assets/characters/heroine.png          64×96, 16×32 frames
      row 0: down (front)  — walk frames 0..3
      row 1: up (back)     — walk frames 0..3
      row 2: right (side)  — walk frames 0..3 (left = mirrored at runtime)
  public/assets/characters/heroine-palettes.json  palette swap tables

Walk frames are drawn from the idle pose: frames 0 and 2 are idle-contact,
1 and 3 lift one leg (front/back) or spread the legs with a 1 px body dip (side).
"""
from __future__ import annotations

import colorsys
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from pixelize import Region, figure, load_rgb, pixelize, shared_palette  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "images/characters/heroine-variants-new.jpg"
OUT_DIR = ROOT / "public/assets/characters"

# Card inner rectangles on the source sheet (source pixels).
CARD_X = [(58, 499), (558, 1008), (1068, 1421), (1491, 1929), (1988, 2433), (2489, 2854)]
CARD_Y = [(49, 686), (752, 1401)]
BG_TOLERANCE = 30
COLORS = 16
DARK_WEIGHT = 3.0
FIT = (16, 30)

# Roles are assigned to palette colors by where they appear on the base sprite.
ROLES = ("hair", "skin", "shirt")

# Recolor options. The base (row 0, col 0) is red hair / light skin / green shirt.
# Other options give the mid-tone of that role, matched by eye to the variants on
# the source sheet; the whole ramp is shifted to it, keeping relative shading.
HAIR_OPTIONS = {"red": None, "brown": "#5a3a26", "blond": "#e9bf55", "violet": "#6b3fc2"}
SKIN_OPTIONS = {"light": None, "tan": "#c98f66", "brown": "#a36a48", "dark": "#6b432e"}
SHIRT_OPTIONS = {"green": None, "blue": "#1ea7d6", "orange": "#e0712b", "violet": "#a774d6"}


def region(row: int, col: int) -> Region:
    (x0, x1), (y0, y1) = CARD_X[col], CARD_Y[row]
    return Region((x0 + 25, y0 + 20, x1 - 25, y1 - 3), bg_tolerance=BG_TOLERANCE)


def to_index(im: Image.Image, palette: list[tuple[int, int, int]]) -> np.ndarray:
    a = np.asarray(im)
    idx = np.full(a.shape[:2], -1, dtype=np.int32)
    for y, x in zip(*np.nonzero(a[..., 3])):
        c = tuple(int(v) for v in a[y, x, :3])
        if c not in palette:
            palette.append(c)
        idx[y, x] = palette.index(c)
    return idx


def nearest(palette: list[tuple[int, int, int]], rgb: tuple[int, int, int]) -> int:
    p = np.array(palette)
    return int(np.argmin(np.abs(p - np.array(rgb)).sum(1)))


# --------------------------------------------------------------------------- roles


def lum(c) -> float:
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def classify_roles(palette, views: dict[str, np.ndarray]) -> dict[int, str]:
    """Assign hair/skin/shirt to palette indices by hue and position on the front view."""
    front = views["down"]
    roles: dict[int, str] = {}
    for i, c in enumerate(palette):
        ys, xs = np.nonzero(front == i)
        if len(ys) == 0:
            ys, xs = np.nonzero(views["right"] == i)
        h, s, v = colorsys.rgb_to_hsv(*(np.array(c) / 255))
        top = ys.mean() < 17 if len(ys) else False
        hue = h * 360
        if 60 <= hue <= 160 and s > 0.3:
            roles[i] = "shirt"
        elif 5 <= hue <= 45 and s < 0.55 and v > 0.75:
            roles[i] = "skin"
        elif top and (hue <= 40 or hue >= 340) and s > 0.35:
            roles[i] = "hair"
    return roles


def hsv_of(hex_or_rgb) -> tuple[float, float, float]:
    if isinstance(hex_or_rgb, str):
        hex_or_rgb = tuple(int(hex_or_rgb[i : i + 2], 16) for i in (1, 3, 5))
    return colorsys.rgb_to_hsv(*(np.array(hex_or_rgb) / 255))


def ramp_median(img_idx: np.ndarray, palette, ids: list[int]) -> tuple[float, float, float]:
    """Pixel-weighted median HSV of a role on the base front view (outline darks ignored)."""
    cols = [palette[i] for i in img_idx[np.isin(img_idx, ids)] if lum(palette[i]) > 40]
    hsv = np.array([hsv_of(c) for c in cols])
    return tuple(np.median(hsv, axis=0))


def shift_ramp(base_cols, base_med, target_med):
    """Move a ramp of colors to a new hue/saturation/value, keeping relative shading."""
    bh, bs, bv = base_med
    th, ts, tv = target_med
    out = []
    for c in base_cols:
        h, s, v = colorsys.rgb_to_hsv(*(np.array(c) / 255))
        nh = (h + (th - bh)) % 1.0
        ns = float(np.clip(s * (ts / max(bs, 1e-3)), 0, 1))
        nv = float(np.clip(v * (tv / max(bv, 1e-3)), 0, 1))
        out.append(tuple(int(round(x * 255)) for x in colorsys.hsv_to_rgb(nh, ns, nv)))
    return out


# --------------------------------------------------------------------------- frames


def patch(idx: np.ndarray, palette, edits: list[tuple[int, int, tuple[int, int, int] | None]]):
    """Hand touch-ups: (x, y, rgb or None for transparent)."""
    for x, y, rgb in edits:
        if rgb is None:
            idx[y, x] = -1
        else:
            if rgb not in palette:
                palette.append(rgb)
            idx[y, x] = palette.index(rgb)


def shift_block(frame: np.ndarray, x0: int, x1: int, y0: int, y1: int, dx: int, dy: int) -> None:
    """Move frame[y0:y1, x0:x1] by (dx, dy); vacated pixels become transparent."""
    block = frame[y0:y1, x0:x1].copy()
    frame[y0:y1, x0:x1] = -1
    h, w = frame.shape
    for y in range(y1 - y0):
        for x in range(x1 - x0):
            v = block[y, x]
            ny, nx = y0 + y + dy, x0 + x + dx
            if v >= 0 and 0 <= ny < h and 0 <= nx < w:
                frame[ny, nx] = v


LEG_TOP = 26  # first row below the belt


def walk_front(idle: np.ndarray) -> list[np.ndarray]:
    """Front/back: lift the left leg, then the right leg, by 1 px; arms counter-swing."""
    frames = [idle]
    for lift_left in (True, False):
        f = idle.copy()
        lx = (0, 8) if lift_left else (8, 16)
        shift_block(f, lx[0], lx[1], LEG_TOP, 32, 0, -1)
        # Re-draw the hidden top row of the lifted leg from the idle frame.
        f[LEG_TOP - 1, lx[0] : lx[1]] = np.where(
            idle[LEG_TOP - 1, lx[0] : lx[1]] >= 0, idle[LEG_TOP - 1, lx[0] : lx[1]], f[LEG_TOP - 1, lx[0] : lx[1]]
        )
        # Opposite arm (outermost two columns, sleeve rows) moves 1 px down.
        ax = (14, 16) if lift_left else (0, 2)
        shift_block(f, ax[0], ax[1], 18, 26, 0, 1)
        frames.append(f)
        frames.append(idle)
    return [frames[0], frames[1], frames[2], frames[3]]


def walk_side(idle: np.ndarray) -> list[np.ndarray]:
    """Side: legs spread front/back with the upper body 1 px lower."""
    spread = idle.copy()
    cols = np.nonzero((idle[LEG_TOP:] >= 0).any(0))[0]
    mid = int(round(cols.mean())) if len(cols) else 8
    shift_block(spread, 0, mid, LEG_TOP, 32, -1, 0)
    shift_block(spread, mid, 16, LEG_TOP, 32, 1, 0)
    shift_block(spread, 0, 16, 0, LEG_TOP, 0, 1)
    return [idle, spread, idle, spread]


# --------------------------------------------------------------------------- main


def main() -> None:
    src = load_rgb(str(SRC))
    base_regions = {"down": region(0, 0), "up": region(0, 1), "right": region(0, 2)}
    figs = [figure(src, r) for r in base_regions.values()]
    pal_arr = shared_palette(figs, COLORS)
    scale = max(max(f[1].shape[0] for f in figs) / FIT[1], max(f[1].shape[1] for f in figs) / FIT[0])

    palette: list[tuple[int, int, int]] = []
    views = {
        name: to_index(pixelize(src, r, (16, 32), palette=pal_arr, scale=scale, dark_weight=DARK_WEIGHT), palette)
        for name, r in base_regions.items()
    }

    roles = classify_roles(palette, views)

    # Below the shoulders nothing is hair: hair-colored pixels there are belt/hands
    # picked up by the color clustering. Move them to belt brown so a hair recolor
    # never tints the belt.
    belt_brown = (80, 40, 34)
    for v in views.values():
        for y, x in zip(*np.nonzero(v >= 0)):
            if y >= 24 and roles.get(int(v[y, x])) == "hair":
                patch(v, palette, [(x, y, belt_brown)])

    # Cheek pixels that clustered with the hair ramp become skin shade, so a hair
    # recolor does not paint the face. Face boxes: (x0, x1, y0, y1) per view.
    skin_ids = sorted([i for i, r in roles.items() if r == "skin"], key=lambda i: lum(palette[i]))
    skin_shade = palette[skin_ids[0]]
    for name, (x0, x1, y0, y1) in {"down": (5, 11, 9, 15), "right": (10, 13, 8, 16)}.items():
        v = views[name]
        for y in range(y0, y1):
            for x in range(x0, x1):
                if roles.get(int(v[y, x])) == "hair":
                    patch(v, palette, [(x, y, skin_shade)])

    # Belt buckle in honey gold (lost in downscaling); a single 2 px buckle on the front.
    gold = (224, 163, 58)
    patch(views["down"], palette, [(7, 25, gold), (8, 25, gold)])

    # Recolor tables: for every role, base colors and their replacement per option.
    def options_for(role: str, table: dict) -> dict:
        base_ids = sorted([i for i, r in roles.items() if r == role], key=lambda i: lum(palette[i]))
        base_cols = [palette[i] for i in base_ids]
        base_med = ramp_median(np.concatenate([views[v].ravel() for v in views]), palette, base_ids)
        result = {}
        for name, target in table.items():
            result[name] = base_cols if target is None else shift_ramp(base_cols, base_med, hsv_of(target))
        return {"base": base_cols, "options": result}

    palettes = {
        "hair": options_for("hair", HAIR_OPTIONS),
        "skin": options_for("skin", SKIN_OPTIONS),
        "shirt": options_for("shirt", SHIRT_OPTIONS),
    }

    rows = [walk_front(views["down"]), walk_front(views["up"]), walk_side(views["right"])]
    sheet = np.full((96, 64, 4), 0, dtype=np.uint8)
    pal_np = np.array(palette, dtype=np.uint8)
    for r, frames in enumerate(rows):
        for c, f in enumerate(frames):
            tile = sheet[r * 32 : (r + 1) * 32, c * 16 : (c + 1) * 16]
            m = f >= 0
            tile[m, :3] = pal_np[f[m]]
            tile[m, 3] = 255

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    Image.fromarray(sheet, "RGBA").save(OUT_DIR / "heroine.png")
    hexed = {
        role: {
            "base": ["#%02x%02x%02x" % c for c in data["base"]],
            "options": {k: ["#%02x%02x%02x" % c for c in v] for k, v in data["options"].items()},
        }
        for role, data in palettes.items()
    }
    (OUT_DIR / "heroine-palettes.json").write_text(json.dumps(hexed, indent=2), encoding="utf-8")
    print("roles:", {r: sum(1 for v in roles.values() if v == r) for r in ROLES})
    print("wrote heroine.png and heroine-palettes.json")


if __name__ == "__main__":
    main()
