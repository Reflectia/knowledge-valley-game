"""Tool icons 16x16 and the in-game mouse cursor, hand-drawn in the style of the sword cursor.

- The sword icon IS the start-menu sword cursor (public/assets/ui/cursor-sword-16.png).
- Hoe, watering can, axe and pickaxe use the sword's palette: steel blade with a pale highlight,
  a brown wooden handle, a gold accent and a thin dark outline (steel outline on metal,
  wood outline on wood). The fill maps below have no outline; it is added around them.
- The game cursor is a parchment arrow, so it is not mistaken for the sword weapon.

Run from the repo root: python scripts/assets/build_tools.py [--review]
"""

import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ITEMS = ROOT / "public" / "assets" / "items"
UI = ROOT / "public" / "assets" / "ui"

# Colors of the sword cursor (cursor-sword-16.png).
PAL = {
    'b': (213, 238, 246),  # steel highlight
    'd': (184, 204, 215),  # steel light
    'e': (150, 163, 173),  # steel
    'c': (115, 125, 138),  # steel mid
    'f': (85, 93, 104),    # steel dark
    'h': (224, 174, 91),   # gold
    'j': (154, 107, 71),   # wood light
    'i': (110, 67, 47),    # wood
    'w': (92, 156, 214),   # water
    'W': (170, 214, 240),  # water light
}
METAL_OUTLINE = (37, 43, 52)
WOOD_OUTLINE = (55, 28, 20)
WOOD = set("jih")

TOOLS = {
    # handle up to the right, a neck and a flat blade hanging down
    "hoe": [
        "................",
        "..........ff....",
        "..........fcc...",
        "........hj.ccd..",
        ".......ji...cdd.",
        "......ji....cdd.",
        ".....ji.....bdd.",
        "....ji......bbd.",
        "...ji...........",
        "..ji............",
        ".ji.............",
        ".i..............",
        "................",
        "................",
        "................",
        "................",
    ],
    # steel can with gold bands, a spout to the upper left and a few drops
    "watering-can": [
        "................",
        "................",
        "........cccc....",
        ".bc....c....c...",
        "..cd..hhhhhhhc..",
        "...cdcdbdddeec..",
        "W...cdbddddeecc.",
        ".....bdddddeefc.",
        "w....cdddddeefc.",
        ".....cdddddeef..",
        ".W...cdddddeef..",
        ".....hhhhhhhhh..",
        "......ffffffff..",
        "................",
        "................",
        "................",
    ],
    # wedge blade with a straight bright edge
    "axe": [
        "................",
        "............b...",
        "...........db...",
        "..........edb...",
        "........fcedb...",
        ".......hjcedb...",
        "......ji.fedb...",
        ".....ji....db...",
        "....ji......b...",
        "...ji...........",
        "..ji............",
        ".ji.............",
        ".i..............",
        "................",
        "................",
        "................",
    ],
    # curved double pick across the top of the handle
    "pickaxe": [
        "................",
        "....dddbb.......",
        "..cdcc...bbd....",
        ".cf.......cdd...",
        ".f........hjdd..",
        ".........ji..dd.",
        "........ji....d.",
        ".......ji.....e.",
        "......ji........",
        ".....ji.........",
        "....ji..........",
        "...ji...........",
        "..ji............",
        "..i.............",
        "................",
        "................",
    ],
}

# In-game cursor: a parchment arrow with a gold tip (honey) and a dark wood outline.
CURSOR_PAL = {'p': (248, 233, 196), 's': (214, 186, 140), 'h': (242, 199, 107)}
CURSOR_OUTLINE = (46, 27, 18)
CURSOR = [
    "................",
    ".h..............",
    ".hp.............",
    ".ppp............",
    ".pppp...........",
    ".ppppp..........",
    ".pppppp.........",
    ".ppppppp........",
    ".pppppppp.......",
    ".ppppsss........",
    ".pps.ps.........",
    ".ps..pps........",
    "......ps........",
    "................",
    "................",
    "................",
]


def paint(rows, pal, outline_of):
    """Fill map -> RGBA with a 1 px outline (4-neighbourhood) around the filled pixels."""
    assert len(rows) == 16 and all(len(r) == 16 for r in rows), [len(r) for r in rows]
    img = np.zeros((16, 16, 4), np.uint8)
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != '.':
                img[y, x] = (*pal[c], 255)
    filled = img[..., 3] > 0
    for y in range(16):
        for x in range(16):
            if filled[y, x]:
                continue
            near = [(y + dy, x + dx) for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))
                    if 0 <= y + dy < 16 and 0 <= x + dx < 16 and filled[y + dy, x + dx]]
            if near:
                img[y, x] = (*outline_of([rows[ny][nx] for ny, nx in near]), 255)
    return Image.fromarray(img, "RGBA")


def tool_outline(chars):
    # wood outline when the neighbours are mostly wood, else the steel outline
    return WOOD_OUTLINE if sum(c in WOOD for c in chars) * 2 > len(chars) else METAL_OUTLINE


def build(out_items: Path, out_ui: Path):
    out_items.mkdir(parents=True, exist_ok=True)
    out_ui.mkdir(parents=True, exist_ok=True)
    for name, rows in TOOLS.items():
        paint(rows, PAL, tool_outline).save(out_items / f"{name}.png")
    shutil.copyfile(UI / "cursor-sword-16.png", out_items / "sword.png")
    cur = paint(CURSOR, CURSOR_PAL, lambda _: CURSOR_OUTLINE)
    cur.save(out_ui / "cursor-arrow-16.png")
    # browsers do not scale cursor images: ship the x2 version used at UI scale x2
    cur.resize((32, 32), Image.NEAREST).save(out_ui / "cursor-arrow-32.png")


def review(dirpath: Path):
    build(dirpath, dirpath)
    names = ["sword", *TOOLS]
    s = 6
    sheet = Image.new("RGBA", ((len(names) + 1) * 20 * s, 20 * s), (58, 50, 44, 255))
    for i, n in enumerate(names):
        sheet.alpha_composite(Image.open(dirpath / f"{n}.png").resize((16 * s, 16 * s), Image.NEAREST), (i * 20 * s + 2 * s, 2 * s))
    sheet.alpha_composite(Image.open(dirpath / "cursor-arrow-16.png").resize((16 * s, 16 * s), Image.NEAREST), (len(names) * 20 * s + 2 * s, 2 * s))
    sheet.save(dirpath / "preview-x6.png")
    print("wrote", dirpath / "preview-x6.png")


if __name__ == "__main__":
    if "--review" in sys.argv:
        review(Path(sys.argv[sys.argv.index("--review") + 1]))
    else:
        build(ITEMS, UI)
        print("tools and cursor written")
