"""Exam trophies 16x16 (stage 11): a temporary self-drawn golden cup per pack.

One cup in the sword cursor's gold with a dark wooden base and a gem in the pack's colour.
They stand in until the owner's art (docs/gemini-prompt-bosses.md, images/items/trophies-new.jpg).

Run from the repo root: python scripts/assets/build_trophies.py [--review DIR]
"""

import sys
from pathlib import Path

from PIL import Image

from build_tools import paint

ROOT = Path(__file__).resolve().parents[2]
ITEMS = ROOT / "public" / "assets" / "items"

GOLD = {
    'H': (248, 214, 128),  # gold highlight
    'h': (224, 174, 91),   # gold (the sword guard)
    'g': (176, 120, 52),   # gold shade
    'j': (154, 107, 71),   # wood light
    'w': (110, 67, 47),    # wood
}
OUTLINE = (55, 28, 20)

CUP = [
    "................",
    "................",
    "...HhhhhhhhhH...",
    ".hhHhhhhhhhhghh.",
    ".h.HhhGGhhhhg.h.",
    ".h.HhGxGGhhhg.h.",
    "..hHhhGGhhhhgh..",
    "...Hhhhhhhhhg...",
    "....hhhhhhhg....",
    "......hhgg......",
    ".......hg.......",
    "......hhgg......",
    "....jjjjjjjj....",
    "....wwwwwwww....",
    "................",
    "................",
]

# Gem (G) and its glint (x) per pack, in the colours of the biome's season.
GEMS = {
    "forest": ((92, 170, 80), (176, 224, 130)),
    "tower": ((110, 176, 222), (222, 244, 255)),
    "market": ((196, 72, 58), (246, 154, 128)),
    "forge": ((226, 118, 40), (255, 202, 112)),
    "library": ((62, 82, 160), (156, 174, 236)),
}


def build(out: Path):
    out.mkdir(parents=True, exist_ok=True)
    for pack, (gem, glint) in GEMS.items():
        pal = {**GOLD, 'G': gem, 'x': glint}
        paint(CUP, pal, lambda _: OUTLINE).save(out / f"trophy-{pack}.png")


def review(dirpath: Path):
    build(dirpath)
    s = 6
    sheet = Image.new("RGBA", (len(GEMS) * 20 * s, 20 * s), (58, 50, 44, 255))
    for i, pack in enumerate(GEMS):
        icon = Image.open(dirpath / f"trophy-{pack}.png").resize((16 * s, 16 * s), Image.NEAREST)
        sheet.alpha_composite(icon, (i * 20 * s + 2 * s, 2 * s))
    sheet.save(dirpath / "trophies-x6.png")
    print("wrote", dirpath / "trophies-x6.png")


if __name__ == "__main__":
    if "--review" in sys.argv:
        review(Path(sys.argv[sys.argv.index("--review") + 1]))
    else:
        build(ITEMS)
        print("trophies written")
