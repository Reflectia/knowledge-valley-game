"""Potion icons 16x16 (stage 13): the owner's potion sprite with the liquid recoloured per potion.

The liquid of public/assets/items/potion.png is the pink-magenta part; its hue is turned to each
potion's colour, keeping the light and shade of every pixel. Glass, cork and outline stay as drawn.

Run from the repo root: python scripts/assets/build_potions.py  -> public/assets/items/potion-<id>.png
"""
import colorsys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ITEMS = ROOT / "public/assets/items"

# Liquid hue in degrees (and a saturation factor) per potion.
HUES = {
    "energy": (48, 1.0),     # golden
    "health": (356, 1.0),    # red
    "growth": (112, 0.85),   # green
    "wisdom": (270, 0.9),    # violet
    "speed": (178, 0.9),     # teal
    "strength": (24, 1.0),   # orange
    "star": (225, 0.95),     # deep blue
}


def is_liquid(r: int, g: int, b: int) -> bool:
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    return s > 0.35 and (h > 0.85 or h < 0.02) and l > 0.25


def build() -> None:
    src = np.asarray(Image.open(ITEMS / "potion.png").convert("RGBA"))
    for name, (hue, sat) in HUES.items():
        out = src.copy()
        for y in range(src.shape[0]):
            for x in range(src.shape[1]):
                r, g, b, a = (int(v) for v in src[y, x])
                if a == 0 or not is_liquid(r, g, b):
                    continue
                _, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
                nr, ng, nb = colorsys.hls_to_rgb(hue / 360, l, min(1.0, s * sat))
                out[y, x] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
        Image.fromarray(out, "RGBA").save(ITEMS / f"potion-{name}.png")
        print(f"  items/potion-{name}.png")


if __name__ == "__main__":
    build()
