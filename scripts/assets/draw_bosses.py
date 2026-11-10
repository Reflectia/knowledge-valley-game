"""Exam bosses 32x32 and trophies 16x16, drawn by hand in simple shapes (stage 11).

Redrawn after the owner's Gemini sheets (images/enemies/bosses-new.jfif, images/items/trophies-new.jfif):
the cut sheets turned fine detail into noise at this size, so each sprite here keeps only big shapes,
6-8 colours, clear eyes and a 1 px dark coloured outline (design system: cute, round, coloured outline).

Run from the repo root:
    python scripts/assets/draw_bosses.py                -> public/assets/bosses/<pack>.png,
                                                           public/assets/items/trophy-<pack>.png
    python scripts/assets/draw_bosses.py --review DIR   -> the same into DIR plus a contact sheet
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PACKS = ["forest", "tower", "market", "forge", "library"]


class Canvas:
    """A grid of colour keys; '.' is empty. Shapes overwrite what is under them."""

    def __init__(self, size: int):
        self.n = size
        self.g = [["."] * size for _ in range(size)]

    def px(self, x: int, y: int, c: str) -> None:
        if 0 <= x < self.n and 0 <= y < self.n:
            self.g[y][x] = c

    def rect(self, x0: int, y0: int, x1: int, y1: int, c: str) -> None:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.px(x, y, c)

    def ellipse(self, cx: float, cy: float, rx: float, ry: float, c: str, where=None) -> None:
        for y in range(self.n):
            for x in range(self.n):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0 and (where is None or where(x, y)):
                    self.px(x, y, c)

    def line(self, x0: float, y0: float, x1: float, y1: float, c: str, w: int = 1) -> None:
        steps = int(max(abs(x1 - x0), abs(y1 - y0))) * 2 + 1
        for i in range(steps + 1):
            t = i / steps
            x, y = round(x0 + (x1 - x0) * t), round(y0 + (y1 - y0) * t)
            for dx in range(w):
                self.px(x + dx, y, c)

    def shade(self, test, frm: str, to: str) -> None:
        for y in range(self.n):
            for x in range(self.n):
                if self.g[y][x] == frm and test(x, y):
                    self.g[y][x] = to

    def image(self, pal: dict[str, tuple[int, int, int]], outline: tuple[int, int, int]) -> Image.Image:
        n = self.n
        img = np.zeros((n, n, 4), np.uint8)
        filled = np.zeros((n, n), bool)
        for y in range(n):
            for x in range(n):
                c = self.g[y][x]
                if c != ".":
                    img[y, x] = (*pal[c], 255)
                    filled[y, x] = True
        for y in range(n):
            for x in range(n):
                if filled[y, x]:
                    continue
                if any(0 <= y + dy < n and 0 <= x + dx < n and filled[y + dy, x + dx] for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))):
                    img[y, x] = (*outline, 255)
        return Image.fromarray(img, "RGBA")


def eye(c: Canvas, cx: int, cy: int, white="W", pupil="k", look=0) -> None:
    """A 3x3 eye: white with a 2-pixel pupil."""
    c.rect(cx - 1, cy - 1, cx + 1, cy + 1, white)
    c.rect(cx + look, cy, cx + look, cy + 1, pupil)


# ----------------------------------------------------------------- bosses


def stump() -> Image.Image:
    """Перенавчений Пень: a stump with a leafy sprout, round glasses and a scroll of notes."""
    c = Canvas(32)
    # sprout and leaves
    c.rect(15, 4, 16, 8, "b")
    c.ellipse(12.5, 4, 3, 1.6, "L")
    c.ellipse(19, 3.5, 3, 1.6, "L")
    c.px(19, 2, "P"), c.px(20, 2, "P"), c.px(20, 3, "P")
    c.shade(lambda x, y: y >= 4, "L", "l")
    # trunk with roots
    c.rect(8, 10, 23, 27, "B")
    c.rect(6, 26, 25, 28, "B")
    c.rect(4, 28, 8, 29, "B"), c.rect(13, 28, 18, 29, "B"), c.rect(23, 28, 27, 29, "B")
    c.shade(lambda x, y: x >= 20 or y >= 27, "B", "b")
    for x in (11, 17, 21):
        c.rect(x, 21, x, 25, "b")
    # cut top
    c.ellipse(15.5, 10, 8.5, 2.6, "T")
    c.ellipse(15.5, 10, 5, 1.2, "t")
    # glasses and grumpy eyes
    for cx in (12, 19):
        c.rect(cx - 2, 14, cx + 2, 17, "G")
        c.rect(cx - 1, 15, cx + 1, 16, "W")
        c.px(cx, 16, "k")
    c.rect(14, 15, 17, 15, "G")
    c.rect(10, 13, 13, 13, "b"), c.rect(18, 13, 21, 13, "b")
    c.rect(14, 20, 17, 20, "k")
    # scroll of notes on the right
    c.rect(24, 17, 28, 26, "S")
    c.rect(24, 17, 28, 17, "s"), c.rect(24, 26, 28, 26, "s")
    for y in (19, 21, 23):
        c.rect(25, y, 27, y, "s")
    pal = {
        "B": (128, 82, 48), "b": (92, 58, 36), "T": (214, 170, 112), "t": (170, 120, 72),
        "L": (124, 196, 86), "l": (70, 140, 64), "P": (244, 156, 186),
        "G": (58, 54, 64), "W": (236, 244, 244), "k": (34, 22, 20),
        "S": (244, 232, 200), "s": (196, 172, 128),
    }
    return c.image(pal, (52, 30, 22))


def golem() -> Image.Image:
    """Галюцинуючий Голем: a round ice golem, one teal eye and one glitching eye, crystal crown."""
    c = Canvas(32)
    # crystal crown and floating shards
    for cx, top, h in ((11, 5, 4), (16, 2, 7), (21, 5, 4)):
        for i in range(h):
            half = min(i // 2, 1)
            c.rect(cx - half, top + i, cx + half, top + i, "C")
    c.px(16, 4, "H"), c.px(16, 5, "H")
    c.rect(4, 8, 5, 9, "C"), c.rect(27, 6, 27, 7, "C")
    # arms, legs, body
    c.ellipse(5, 18, 2.4, 4.2, "I")
    c.ellipse(26, 18, 2.4, 4.2, "I")
    c.rect(10, 24, 13, 28, "i"), c.rect(18, 24, 21, 28, "i")
    c.ellipse(15.5, 16, 10, 9, "I")
    c.shade(lambda x, y: (x - 15.5) + (y - 16) > 7, "I", "i")
    c.ellipse(10.5, 11, 2.2, 1.2, "H")
    # eyes: teal glow on the left, pixel noise on the right
    c.ellipse(11.5, 15.5, 2.6, 2.6, "k")
    c.rect(11, 15, 12, 16, "E")
    c.px(11, 15, "H")
    for y in range(13, 18):
        for x in range(18, 23):
            c.px(x, y, "V" if (x + y) % 2 else "k")
    # rune on the belly
    c.px(15, 21, "R"), c.px(16, 20, "R"), c.px(17, 21, "R"), c.px(14, 22, "R"), c.px(18, 22, "R")
    pal = {
        "I": (140, 206, 244), "i": (88, 152, 214), "H": (230, 248, 255), "C": (180, 230, 255),
        "E": (72, 236, 204), "k": (26, 34, 66), "V": (164, 112, 230), "R": (70, 112, 196),
    }
    return c.image(pal, (34, 44, 92))


def mimic() -> Image.Image:
    """Беклог-Мімік: a chest with a friendly toothy grin, bursting with sticky notes."""
    c = Canvas(32)
    # sticky notes and a scroll behind the open lid
    c.rect(8, 4, 11, 7, "y"), c.rect(13, 3, 16, 6, "p"), c.rect(18, 4, 21, 7, "g"), c.rect(22, 6, 25, 9, "c")
    c.line(23, 2, 27, 7, "S", 2)
    # lid
    c.rect(5, 7, 26, 12, "w")
    c.rect(6, 8, 25, 11, "W")
    # body
    c.rect(5, 13, 26, 27, "W")
    c.shade(lambda x, y: x >= 22 or y >= 25, "W", "w")
    # gold bands and lock
    c.rect(5, 13, 26, 13, "Y")
    c.rect(5, 7, 5, 27, "Y"), c.rect(26, 7, 26, 27, "Y")
    c.rect(14, 24, 17, 27, "Y")
    c.px(15, 25, "k"), c.px(16, 25, "k")
    # eyes and grin
    eye(c, 11, 16, white="E"), eye(c, 20, 16, white="E")
    c.rect(9, 19, 22, 22, "k")
    for x in range(10, 22, 2):
        c.px(x, 19, "T"), c.px(x + 1, 22, "T")
    c.rect(12, 21, 19, 21, "r")
    # feet
    c.rect(7, 28, 10, 29, "w"), c.rect(21, 28, 24, 29, "w")
    pal = {
        "W": (178, 108, 54), "w": (122, 70, 38), "Y": (232, 182, 72), "k": (40, 20, 18),
        "T": (250, 244, 228), "E": (250, 244, 228), "r": (200, 72, 72), "y": (250, 220, 90), "p": (240, 120, 170),
        "g": (120, 210, 120), "c": (110, 200, 230), "S": (240, 226, 190),
    }
    return c.image(pal, (58, 30, 20))


def monolith() -> Image.Image:
    """Моноліт-Спагеті: an iron block golem with ember eyes, a chimney and one tangled cable."""
    c = Canvas(32)
    # smoke and chimney
    c.rect(22, 1, 23, 2, "S"), c.rect(24, 0, 25, 1, "S")
    c.rect(20, 4, 22, 9, "m")
    # arms and legs
    c.rect(3, 12, 6, 21, "m"), c.rect(25, 12, 28, 21, "m")
    c.rect(9, 25, 13, 29, "m"), c.rect(18, 25, 22, 29, "m")
    # body block
    c.rect(7, 9, 24, 25, "M")
    c.rect(7, 9, 24, 9, "h"), c.rect(7, 9, 7, 25, "h")
    c.shade(lambda x, y: x >= 22 or y >= 24, "M", "m")
    # angry brows and ember eyes
    c.line(10, 12, 13, 13, "k"), c.line(18, 13, 21, 12, "k")
    c.rect(10, 14, 13, 16, "O"), c.rect(18, 14, 21, 16, "O")
    c.rect(11, 15, 12, 15, "o"), c.rect(19, 15, 20, 15, "o")
    # grill mouth
    c.rect(12, 19, 19, 21, "k")
    for x in (13, 15, 17):
        c.rect(x, 19, x, 21, "m")
    # one copper cable looping round the waist and down an arm
    c.line(4, 22, 7, 23, "c", 1)
    c.rect(7, 23, 24, 23, "c")
    c.line(24, 23, 27, 21, "c", 1)
    c.rect(26, 21, 26, 26, "c")
    pal = {
        "M": (120, 124, 134), "m": (84, 86, 98), "h": (168, 172, 182), "k": (34, 30, 36),
        "O": (246, 128, 40), "o": (255, 214, 120), "c": (204, 112, 56), "S": (200, 200, 206),
    }
    return c.image(pal, (40, 34, 40))


def reviewer() -> Image.Image:
    """Рецензент Номер Два: a grumpy book in round glasses, a red quill and a ribbon."""
    c = Canvas(32)
    # red quill on the left
    c.line(3, 7, 7, 21, "R", 2)
    c.line(4, 9, 7, 19, "r", 1)
    c.line(7, 21, 8, 24, "k", 1)
    # book: cover, spine, pages
    c.rect(9, 5, 25, 28, "L")
    c.rect(9, 5, 11, 28, "l")
    c.rect(24, 6, 26, 27, "P")
    c.rect(24, 6, 24, 27, "p")
    c.px(12, 6, "Y"), c.px(23, 6, "Y"), c.px(12, 27, "Y"), c.px(23, 27, "Y")
    # pen on the right
    c.line(28, 8, 29, 20, "M", 1)
    c.px(29, 21, "k")
    # brows, glasses, frown
    c.line(13, 11, 16, 12, "k"), c.line(19, 12, 22, 11, "k")
    for cx in (15, 20):
        c.rect(cx - 2, 13, cx + 2, 17, "k")
        c.rect(cx - 1, 14, cx + 1, 16, "W")
        c.px(cx, 15, "k")
    c.rect(17, 15, 18, 15, "k")
    c.rect(15, 21, 20, 21, "k"), c.px(14, 22, "k"), c.px(21, 22, "k")
    # bookmark ribbon
    c.rect(20, 28, 21, 30, "R")
    pal = {
        "L": (150, 78, 44), "l": (104, 52, 32), "P": (244, 230, 196), "p": (206, 186, 146),
        "Y": (232, 182, 72), "k": (36, 22, 20), "W": (226, 240, 244), "R": (206, 52, 52),
        "r": (150, 30, 36), "M": (150, 156, 168),
    }
    return c.image(pal, (50, 26, 18))


BOSSES = {"forest": stump, "tower": golem, "market": mimic, "forge": monolith, "library": reviewer}

# ----------------------------------------------------------------- trophies

GOLD = {"H": (252, 222, 140), "h": (226, 176, 86), "g": (170, 112, 48), "j": (150, 100, 64), "w": (104, 62, 40)}
TROPHY_OUTLINE = (55, 28, 20)


def base(c: Canvas) -> None:
    c.rect(4, 12, 11, 12, "j")
    c.rect(3, 13, 12, 14, "w")


def acorn() -> Image.Image:
    c = Canvas(16)
    c.ellipse(3, 8, 2, 1.3, "L"), c.ellipse(12, 8, 2, 1.3, "L")
    c.ellipse(7.5, 6.5, 3, 3, "h")
    c.ellipse(6.5, 5.5, 1, 1, "H")
    c.rect(4, 3, 11, 4, "g"), c.rect(5, 2, 10, 2, "g")
    c.rect(7, 1, 8, 1, "w")
    c.rect(7, 10, 8, 11, "g")
    base(c)
    return c.image({**GOLD, "L": (96, 172, 72)}, TROPHY_OUTLINE)


def snowflake() -> Image.Image:
    c = Canvas(16)
    c.ellipse(7.5, 6, 5.2, 5.2, "h")
    c.ellipse(7.5, 6, 4, 4, "B")
    c.rect(7, 2, 8, 10, "C"), c.rect(3, 5, 12, 6, "C")
    c.line(4, 3, 11, 9, "C"), c.line(11, 3, 4, 9, "C")
    c.rect(7, 5, 8, 6, "G")
    c.rect(7, 11, 8, 11, "g")
    base(c)
    return c.image({**GOLD, "B": (40, 70, 120), "C": (214, 240, 255), "G": (90, 200, 240)}, TROPHY_OUTLINE)


def scales() -> Image.Image:
    c = Canvas(16)
    c.rect(7, 2, 8, 11, "h")
    c.rect(2, 3, 13, 3, "h")
    c.px(7, 1, "H"), c.px(8, 1, "H")
    c.line(2, 4, 1, 6, "g"), c.line(4, 4, 5, 6, "g")
    c.line(11, 4, 10, 6, "g"), c.line(13, 4, 14, 6, "g")
    c.rect(1, 7, 5, 7, "h"), c.rect(2, 8, 4, 8, "g")
    c.rect(10, 7, 14, 7, "h"), c.rect(11, 8, 13, 8, "g")
    c.rect(6, 4, 9, 5, "R"), c.px(6, 6, "R"), c.px(9, 6, "R")
    base(c)
    return c.image({**GOLD, "R": (206, 56, 56)}, TROPHY_OUTLINE)


def anvil() -> Image.Image:
    c = Canvas(16)
    c.rect(7, 2, 8, 2, "f"), c.rect(6, 3, 9, 4, "F"), c.rect(7, 3, 8, 3, "f")
    c.rect(4, 6, 13, 7, "h"), c.rect(1, 6, 3, 6, "h"), c.px(3, 7, "h")
    c.rect(4, 6, 13, 6, "H")
    c.rect(6, 8, 10, 9, "g")
    c.rect(4, 10, 12, 11, "h")
    base(c)
    return c.image({**GOLD, "F": (246, 120, 40), "f": (255, 214, 110)}, TROPHY_OUTLINE)


def quill_globe() -> Image.Image:
    c = Canvas(16)
    c.ellipse(6.5, 6, 4.2, 4.2, "N")
    c.px(4, 4, "S"), c.px(8, 7, "S"), c.px(5, 8, "s")
    c.line(13, 1, 6, 9, "h", 2)
    c.line(13, 1, 9, 5, "H", 1)
    c.rect(6, 10, 7, 11, "g")
    base(c)
    return c.image({**GOLD, "N": (40, 52, 120), "S": (252, 236, 150), "s": (150, 170, 236)}, TROPHY_OUTLINE)


TROPHIES = {"forest": acorn, "tower": snowflake, "market": scales, "forge": anvil, "library": quill_globe}


def build(out_bosses: Path, out_items: Path) -> list[Image.Image]:
    out_bosses.mkdir(parents=True, exist_ok=True)
    out_items.mkdir(parents=True, exist_ok=True)
    made = []
    for pack in PACKS:
        im = BOSSES[pack]()
        im.save(out_bosses / f"{pack}.png")
        made.append(im)
    for pack in PACKS:
        im = TROPHIES[pack]()
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
        contact(build(d / "bosses", d / "items"), d / "drawn-x6.png")
    else:
        build(ROOT / "public/assets/bosses", ROOT / "public/assets/items")
        print("bosses and trophies drawn")
