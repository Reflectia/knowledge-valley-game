"""Unique lab items 16x16 (25: five per pack), drawn by hand in simple shapes.

Each one is drawn after its name in src/content/packs/<pack>.json, in the style of the exam
trophies (draw_bosses.py): big shapes, few colours, a 1 px dark coloured outline.

Run from the repo root:
    python scripts/assets/draw_uniques.py                -> public/assets/uniques/<id>.png
    python scripts/assets/draw_uniques.py --review DIR   -> the same into DIR plus a contact sheet
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from draw_bosses import Canvas  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/assets/uniques"

BROWN_OUT = (55, 28, 20)
BLUE_OUT = (28, 36, 72)
IRON_OUT = (34, 32, 40)

GOLD = {"H": (252, 222, 140), "h": (226, 176, 86), "g": (170, 112, 48)}
WOOD = {"j": (168, 112, 70), "w": (112, 68, 42)}
IRON = {"I": (170, 176, 188), "i": (118, 124, 138), "d": (78, 82, 96)}
ICE = {"C": (214, 240, 255), "c": (140, 200, 240), "b": (80, 140, 210)}


def done(c: Canvas, pal: dict, outline=BROWN_OUT) -> Image.Image:
    return c.image(pal, outline)


# ----------------------------------------------------------------- forest (modelling)


def acorn_hypothesis():
    c = Canvas(16)
    c.ellipse(7.5, 10, 4, 4.2, "n")
    c.ellipse(6, 8.5, 1.2, 1.5, "N")
    c.rect(3, 4, 12, 6, "k"), c.rect(4, 3, 11, 3, "k")
    c.px(5, 5, "K"), c.px(8, 4, "K"), c.px(10, 5, "K")
    c.rect(7, 1, 8, 2, "w")
    c.px(12, 1, "Y"), c.px(13, 2, "Y"), c.px(11, 2, "Y")
    return done(c, {"n": (196, 140, 76), "N": (232, 186, 116), "k": (118, 76, 42), "K": (150, 100, 56), "w": (90, 56, 34), "Y": (252, 226, 120)})


def leaf_validation():
    c = Canvas(16)
    c.ellipse(8, 7, 5.5, 4, "L", where=lambda x, y: abs((x - 8) - (y - 7)) < 6)
    c.line(3, 12, 12, 3, "l")
    c.line(2, 13, 4, 11, "w")
    c.px(9, 9, "W"), c.px(10, 10, "W"), c.px(11, 9, "W"), c.px(12, 8, "W"), c.px(13, 7, "W")
    return done(c, {"L": (112, 190, 82), "l": (62, 130, 58), "w": (96, 62, 38), "W": (250, 250, 240)}, (30, 60, 30))


def root_regression():
    c = Canvas(16)
    c.rect(6, 1, 9, 4, "w")
    c.line(7, 5, 3, 13, "r", 2)
    c.line(8, 5, 12, 13, "r", 2)
    c.line(7, 5, 7, 14, "R", 2)
    c.line(1, 14, 14, 2, "g")
    return done(c, {"w": (120, 80, 48), "r": (150, 104, 64), "R": (120, 80, 48), "g": (120, 200, 90)})


def flower_gradient():
    c = Canvas(16)
    c.rect(7, 9, 8, 14, "s")
    c.ellipse(4, 12, 2, 1, "s")
    for (x, y), col in zip([(7.5, 2.5), (11, 5.5), (9.5, 9), (5.5, 9), (4, 5.5)], ["p", "o", "y", "o", "p"]):
        c.ellipse(x, y, 2, 2, col)
    c.ellipse(7.5, 6, 1.6, 1.6, "c")
    return done(c, {"s": (80, 150, 70), "p": (240, 120, 170), "o": (246, 164, 120), "y": (250, 214, 100), "c": (130, 80, 40)}, (70, 30, 40))


def seed_network():
    c = Canvas(16)
    c.ellipse(7.5, 8.5, 5, 6, "n")
    c.ellipse(6, 6, 1.5, 2, "N")
    pts = [(5, 7), (10, 6), (8, 10), (5, 12), (11, 11)]
    for a, b in [(0, 1), (0, 2), (1, 2), (2, 3), (2, 4)]:
        c.line(*pts[a], *pts[b], "l")
    for x, y in pts:
        c.px(x, y, "T")
    c.rect(7, 1, 8, 2, "g"), c.px(9, 1, "g")
    return done(c, {"n": (150, 104, 60), "N": (190, 140, 86), "l": (90, 200, 190), "T": (200, 255, 240), "g": (100, 180, 80)})


# ----------------------------------------------------------------- tower (AI)


def gear_intuition():
    c = Canvas(16)
    for x, y in [(7, 1), (7, 13), (1, 7), (13, 7), (3, 3), (11, 3), (3, 11), (11, 11)]:
        c.rect(x, y, x + 1, y + 1, "I")
    c.ellipse(7.5, 7.5, 5, 5, "I")
    c.ellipse(7.5, 7.5, 5, 5, "i", where=lambda x, y: x + y > 16)
    c.ellipse(7.5, 7.5, 2.2, 2.2, "T")
    c.px(7, 7, "W")
    return done(c, {**IRON, "T": (72, 236, 204), "W": (230, 255, 250)}, IRON_OUT)


def snowflake_data():
    c = Canvas(16)
    # a round ice token with the snowflake on it: no closed gaps that the outline would fill
    c.ellipse(7.5, 7.5, 6.5, 6.5, "c")
    c.rect(7, 2, 8, 13, "C"), c.rect(2, 7, 13, 8, "C")
    c.line(4, 4, 11, 11, "C"), c.line(11, 4, 4, 11, "C")
    c.rect(7, 7, 8, 8, "b")
    return done(c, ICE, BLUE_OUT)


def owl_feather():
    c = Canvas(16)
    c.ellipse(9.5, 6, 2.6, 5.2, "f")
    c.ellipse(9.5, 6, 2.6, 5.2, "F", where=lambda x, y: x >= 10)
    c.line(12, 1, 5, 12, "s")
    c.rect(3, 12, 4, 14, "I"), c.px(5, 13, "i")
    return done(c, {"f": (196, 140, 86), "F": (232, 186, 120), "s": (110, 70, 40), **IRON}, BROWN_OUT)


def lens_probability():
    c = Canvas(16)
    c.line(10, 10, 14, 14, "w", 2)
    c.ellipse(6.5, 6.5, 5, 5, "h")
    c.ellipse(6.5, 6.5, 3.6, 3.6, "c")
    c.ellipse(5.5, 5.5, 1, 1, "C")
    c.px(8, 8, "b"), c.px(6, 8, "b"), c.px(8, 6, "b")
    return done(c, {**GOLD, **WOOD, **ICE}, BROWN_OUT)


def golem_heart():
    c = Canvas(16)
    c.ellipse(5, 6, 3.5, 3.5, "c"), c.ellipse(10, 6, 3.5, 3.5, "c")
    for y in range(7, 14):
        half = 6 - (y - 7)
        c.rect(round(7.5 - half), y, round(7.5 + half), y, "c")
    c.shade(lambda x, y: x + y > 15, "c", "b")
    c.ellipse(4.5, 5, 1.2, 1, "C")
    return done(c, ICE, BLUE_OUT)


# ----------------------------------------------------------------- market (management)


def hourglass_deadline():
    c = Canvas(16)
    c.rect(3, 1, 12, 2, "w"), c.rect(3, 13, 12, 14, "w")
    c.rect(3, 3, 3, 12, "j"), c.rect(12, 3, 12, 12, "j")
    for y in range(3, 8):
        c.rect(4 + (y - 3), y, 11 - (y - 3), y, "G")
    for y in range(8, 13):
        c.rect(4 + (12 - y), y, 11 - (12 - y), y, "G")
    c.rect(6, 4, 9, 5, "s"), c.rect(5, 11, 10, 12, "s"), c.px(7, 8, "s"), c.px(8, 9, "s")
    return done(c, {**WOOD, "G": (214, 236, 244), "s": (240, 196, 90)})


def scroll_plan():
    c = Canvas(16)
    c.rect(3, 3, 12, 12, "P")
    c.rect(2, 2, 13, 3, "p"), c.rect(2, 12, 13, 13, "p")
    for y in (5, 7, 9):
        c.rect(5, y, 10, y, "k")
    c.px(5, 5, "r"), c.px(5, 7, "r"), c.px(5, 9, "r")
    return done(c, {"P": (246, 232, 198), "p": (206, 178, 130), "k": (120, 90, 60), "r": (200, 60, 60)})


def coin_priority():
    c = Canvas(16)
    c.ellipse(7.5, 7.5, 6, 6, "h")
    c.ellipse(7.5, 7.5, 4.5, 4.5, "g")
    c.ellipse(7.5, 7.5, 3.8, 3.8, "h")
    c.rect(7, 4, 8, 11, "H"), c.rect(4, 7, 11, 8, "H")
    c.px(5, 5, "H"), c.px(10, 5, "H"), c.px(5, 10, "H"), c.px(10, 10, "H")
    return done(c, GOLD)


def scales_compromise():
    c = Canvas(16)
    c.rect(7, 2, 8, 13, "I")
    c.rect(2, 3, 13, 3, "I")
    c.line(2, 4, 1, 7, "i"), c.line(3, 4, 4, 7, "i")
    c.line(12, 4, 11, 7, "i"), c.line(13, 4, 14, 7, "i")
    c.rect(1, 8, 4, 8, "h"), c.rect(11, 8, 14, 8, "h")
    c.rect(5, 13, 10, 14, "w")
    return done(c, {**IRON, **GOLD, **WOOD}, IRON_OUT)


def lantern_team():
    c = Canvas(16)
    c.rect(6, 1, 9, 1, "d"), c.px(5, 2, "d"), c.px(10, 2, "d")
    c.rect(4, 3, 11, 4, "d")
    c.rect(4, 5, 11, 12, "d")
    c.rect(5, 5, 10, 11, "L")
    c.rect(6, 6, 9, 10, "Y")
    c.rect(7, 7, 8, 9, "W")
    c.rect(3, 13, 12, 14, "d")
    return done(c, {"d": (70, 66, 80), "L": (250, 180, 70), "Y": (255, 220, 110), "W": (255, 250, 220)}, IRON_OUT)


# ----------------------------------------------------------------- forge (architecture)


def hammer_modularity():
    c = Canvas(16)
    c.line(3, 13, 9, 7, "w", 2)
    c.rect(7, 2, 13, 6, "I")
    c.rect(7, 2, 13, 2, "H")
    c.rect(7, 6, 13, 6, "i"), c.rect(13, 3, 13, 6, "i")
    return done(c, {**WOOD, **IRON, "H": (210, 214, 224)}, IRON_OUT)


def anvil_interfaces():
    c = Canvas(16)
    c.rect(3, 4, 13, 6, "I"), c.rect(1, 4, 2, 4, "I"), c.px(2, 5, "I")
    c.rect(3, 4, 13, 4, "H")
    c.rect(6, 7, 10, 9, "i")
    c.rect(4, 10, 12, 12, "d")
    c.px(5, 5, "T"), c.px(8, 5, "T"), c.px(11, 5, "T")
    return done(c, {**IRON, "H": (210, 214, 224), "T": (240, 150, 60)}, IRON_OUT)


def blueprint_foundation():
    c = Canvas(16)
    c.rect(2, 2, 13, 13, "B")
    for v in (5, 8, 11):
        c.rect(v, 3, v, 12, "b"), c.rect(3, v, 12, v, "b")
    # a white house drawn on the sheet: roof, walls and a door
    for i in range(3):
        c.rect(7 - i, 4 + i, 8 + i, 4 + i, "W")
    c.rect(4, 7, 11, 7, "W")
    c.rect(5, 8, 5, 11, "W"), c.rect(10, 8, 10, 11, "W"), c.rect(5, 11, 10, 11, "W")
    c.rect(7, 9, 8, 10, "W")
    return done(c, {"B": (52, 96, 170), "b": (80, 130, 200), "W": (226, 240, 255)}, BLUE_OUT)


def key_dependencies():
    c = Canvas(16)
    c.ellipse(4.5, 4.5, 3.2, 3.2, "h")
    c.line(6, 6, 13, 13, "h", 2)
    c.rect(10, 12, 11, 14, "h"), c.rect(12, 10, 14, 11, "h")
    c.px(3, 3, "H")
    c.ellipse(4.5, 4.5, 1.4, 1.4, ".")  # the ring's hole is see-through
    return done(c, GOLD)


def crown_architect():
    c = Canvas(16)
    c.rect(2, 7, 13, 12, "h")
    for x in (2, 7, 12):
        c.rect(x, 3, x + 1, 6, "h")
    c.px(4, 6, "h"), c.px(5, 6, "h"), c.px(10, 6, "h"), c.px(11, 6, "h"), c.px(5, 5, "h"), c.px(10, 5, "h")
    c.rect(2, 11, 13, 12, "g")
    c.rect(4, 8, 5, 9, "R"), c.rect(7, 8, 8, 9, "B"), c.rect(10, 8, 11, 9, "R")
    c.px(2, 2, "H"), c.px(7, 2, "H"), c.px(12, 2, "H")
    return done(c, {**GOLD, "R": (210, 60, 70), "B": (70, 130, 220)})


# ----------------------------------------------------------------- library (science)


def quill_hypothesis():
    c = Canvas(16)
    c.ellipse(4.5, 12, 3, 2.5, "k")
    c.rect(3, 9, 6, 9, "k")
    c.line(5, 10, 13, 1, "f", 2)
    c.line(9, 6, 13, 1, "F", 1)
    c.line(5, 10, 7, 8, "s", 1)
    return done(c, {"k": (40, 40, 70), "f": (240, 240, 232), "F": (200, 206, 220), "s": (150, 150, 160)}, BLUE_OUT)


def star_map():
    c = Canvas(16)
    c.rect(1, 3, 14, 12, "N")
    c.rect(1, 3, 1, 12, "n"), c.rect(14, 3, 14, 12, "n")
    pts = [(3, 9), (6, 5), (9, 8), (12, 5)]
    for a, b in zip(pts, pts[1:]):
        c.line(*a, *b, "l")
    for x, y in pts:
        c.px(x, y, "S")
    c.px(4, 5, "s"), c.px(11, 10, "s")
    return done(c, {"N": (36, 50, 110), "n": (230, 210, 160), "l": (110, 140, 220), "S": (255, 236, 150), "s": (180, 190, 240)}, BLUE_OUT)


def telescope_review():
    c = Canvas(16)
    c.line(2, 11, 11, 3, "h", 3)
    c.line(9, 5, 13, 1, "g", 2)
    c.rect(1, 11, 3, 13, "g")
    c.line(7, 9, 4, 14, "w"), c.line(8, 9, 11, 14, "w")
    c.px(12, 1, "C")
    return done(c, {**GOLD, **WOOD, "C": (200, 236, 255)})


def flask_experiment():
    c = Canvas(16)
    c.rect(6, 1, 9, 5, "G")
    c.rect(5, 1, 10, 1, "w")
    c.ellipse(7.5, 10, 5, 4.5, "G")
    c.ellipse(7.5, 11, 4.2, 3, "L")
    c.px(6, 10, "W"), c.px(9, 11, "W"), c.px(8, 9, "W")
    c.px(5, 7, "W")
    return done(c, {"G": (214, 236, 244), "L": (110, 210, 110), "W": (240, 255, 240), **WOOD}, (40, 60, 70))


def star_atlas():
    c = Canvas(16)
    c.rect(2, 2, 13, 13, "N")
    c.rect(2, 2, 3, 13, "n")
    c.rect(13, 3, 13, 12, "P")
    c.ellipse(8.5, 7.5, 2.5, 2.5, "S", where=lambda x, y: abs(x - 8.5) + abs(y - 7.5) <= 3)
    c.px(8, 7, "H"), c.px(9, 7, "H")
    c.px(5, 4, "s"), c.px(11, 11, "s"), c.px(6, 11, "s")
    return done(c, {"N": (40, 56, 130), "n": (28, 36, 90), "P": (244, 230, 196), "S": (240, 196, 80), "H": (255, 240, 170), "s": (200, 210, 250)}, BLUE_OUT)


UNIQUES = {
    "forest": [acorn_hypothesis, leaf_validation, root_regression, flower_gradient, seed_network],
    "tower": [gear_intuition, snowflake_data, owl_feather, lens_probability, golem_heart],
    "market": [hourglass_deadline, scroll_plan, coin_priority, scales_compromise, lantern_team],
    "forge": [hammer_modularity, anvil_interfaces, blueprint_foundation, key_dependencies, crown_architect],
    "library": [quill_hypothesis, star_map, telescope_review, flask_experiment, star_atlas],
}


def build(out: Path) -> list[Image.Image]:
    out.mkdir(parents=True, exist_ok=True)
    made = []
    for pack, draws in UNIQUES.items():
        for i, draw in enumerate(draws, start=1):
            im = draw()
            im.save(out / f"{pack}-unique-{i}.png")
            made.append(im)
    return made


def contact(images: list[Image.Image], path: Path, s: int = 6) -> None:
    cols = 5
    rows = (len(images) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * 20 * s, rows * 20 * s), (58, 50, 44, 255))
    for i, im in enumerate(images):
        sheet.alpha_composite(im.resize((16 * s, 16 * s), Image.NEAREST), ((i % cols) * 20 * s + 2 * s, (i // cols) * 20 * s + 2 * s))
    sheet.save(path)
    print("wrote", path)


if __name__ == "__main__":
    if "--review" in sys.argv:
        d = Path(sys.argv[sys.argv.index("--review") + 1])
        contact(build(d), d / "uniques-x6.png")
    else:
        build(OUT)
        print("uniques drawn")
