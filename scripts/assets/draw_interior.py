"""Draw temporary interior tiles for the heroine's house (16×16, design-system palette).

Run from the repo root:  python scripts/assets/draw_interior.py
Writes public/assets/_temp/interior/interior-16.png. Placeholder art, listed in ASSETS-TODO.md.

Tile order (frame index):
  0 floor          1 floor (knot)    2 log wall        3 log wall + baseboard
  4 wall + window  5 door mat (exit) 6 rug             7 desk with the journal
  8 bed (head)     9 bed (foot)     10 bookshelf      11 chest
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/assets/_temp/interior/interior-16.png"

# design-system tokens
P = {
    ".": None,
    "K": "#2e1b12",  # wood-900
    "D": "#5a3420",  # wood-700
    "M": "#8a5530",  # wood-500
    "L": "#b97d45",  # wood-300
    "l": "#a86d3a",  # grain (between wood-500 and wood-300)
    "W": "#fbf3dc",  # parchment-50
    "w": "#f3e2b8",  # parchment-100
    "p": "#e8d09c",  # parchment-200
    "q": "#c9a565",  # parchment-300
    "G": "#466e2e",  # moss-600
    "g": "#4a7330",  # moss-500
    "h": "#3d6128",  # moss-700
    "Y": "#e0a33a",  # honey-500
    "y": "#f2c76b",  # honey-300
    "R": "#2c6670",  # river-600
    "r": "#7cc4c0",  # river-300
    "C": "#a3432c",  # clay-600
}

TILES: list[list[str]] = []


def tile(rows: str) -> None:
    lines = [ln for ln in rows.strip("\n").split("\n")]
    assert len(lines) == 16 and all(len(ln) == 16 for ln in lines), rows
    TILES.append(lines)


# 0 floor: horizontal planks, seams every 4 rows, staggered joints
tile("""
LLLLLlLLLLLLLLLL
LLLLLMLLLLLLlLLL
LLlLLMLLLLLLLLLL
MMMMMMMMMMMMMMMM
LLLLLLLLLLLLMLLL
LLLLLLlLLLLLMLLL
LLLLLLLLLLLLMLlL
MMMMMMMMMMMMMMMM
LLMLLLLLLLlLLLLL
LLMLLLLLLLLLLLLL
LlMLLLLLLLLLLLLL
MMMMMMMMMMMMMMMM
LLLLLLLLLMLLLLLL
LLLLlLLLLMLLLLLL
LLLLLLLLLMLLLlLL
MMMMMMMMMMMMMMMM
""")
# 1 floor with a knot
tile("""
LLLLLlLLLLLLLLLL
LLLLLMLLLLLLlLLL
LLlLLMLLLLLLLLLL
MMMMMMMMMMMMMMMM
LLLLLLLLLLLLMLLL
LLLLLLMlLLLLMLLL
LLLLLlMMlLLLMLlL
MMMMMMMMMMMMMMMM
LLMLLLLLLLlLLLLL
LLMLLLLLLLLLLLLL
LlMLLLLLLLLLLLLL
MMMMMMMMMMMMMMMM
LLLLLLLLLMLLLLLL
LLLLlLLLLMLLLLLL
LLLLLLLLLMLLLlLL
MMMMMMMMMMMMMMMM
""")
# 2 log wall
tile("""
LLLLLLLLLLLLLLLL
MMMMMMMMMMMMMMMM
MMMlMMMMMMMMMlMM
MMMMMMMMMMMMMMMM
DDDDDDDDDDDDDDDD
LLLLLLLLLLLLLLLL
MMMMMMMMMMMMMMMM
MMMMMMMlMMMMMMMM
MMMMMMMMMMMMMMMM
DDDDDDDDDDDDDDDD
LLLLLLLLLLLLLLLL
MMMMMMMMMMMMMMMM
MlMMMMMMMMMMlMMM
MMMMMMMMMMMMMMMM
DDDDDDDDDDDDDDDD
DDDDDDDDDDDDDDDD
""")
# 3 log wall + baseboard
tile("""
LLLLLLLLLLLLLLLL
MMMMMMMMMMMMMMMM
MMMlMMMMMMMMMlMM
MMMMMMMMMMMMMMMM
DDDDDDDDDDDDDDDD
LLLLLLLLLLLLLLLL
MMMMMMMMMMMMMMMM
MMMMMMMlMMMMMMMM
MMMMMMMMMMMMMMMM
DDDDDDDDDDDDDDDD
LLLLLLLLLLLLLLLL
MMMMMMMMMMMMMMMM
DDDDDDDDDDDDDDDD
DDDDDDDDDDDDDDDD
KKKKKKKKKKKKKKKK
KKKKKKKKKKKKKKKK
""")
# 4 wall with a window
tile("""
LLLLLLLLLLLLLLLL
MMMMMMMMMMMMMMMM
MMKKKKKKKKKKKKMM
MMKrrrrKrrrrrKMM
DDKrWrrKrrrrrKDD
LLKrrrrKrrrrrKLL
MMKrrrrKrrrrrKMM
MMKKKKKKKKKKKKMM
MMKRrrrKrrrrRKMM
DDKRRrrKrrrRRKDD
LLKRRRrKrrRRRKLL
MMKKKKKKKKKKKKMM
MlDDDDDDDDDDDDlM
MMMMMMMMMMMMMMMM
DDDDDDDDDDDDDDDD
DDDDDDDDDDDDDDDD
""")
# 5 door mat (exit)
tile("""
LLLLLLLLLLLLLLLL
LLLLLLLLLLLLLLLL
LLDDDDDDDDDDDDLL
LLDYDYDYDYDYDDLL
LLDDDDDDDDDDDDLL
LLDYDYDYDYDYDDLL
LLDDDDDDDDDDDDLL
LLDYDYDYDYDYDDLL
LLDDDDDDDDDDDDLL
MMMMMMMMMMMMMMMM
LLLLLLLLLLLLMLLL
LLLLLLlLLLLLMLLL
LLLLLLLLLLLLMLlL
MMMMMMMMMMMMMMMM
LLMLLLLLLLlLLLLL
LLMLLLLLLLLLLLLL
""")
# 6 rug
tile("""
CCCCCCCCCCCCCCCC
CYYYYYYYYYYYYYYC
CYppppppppppppYC
CYpqpppqpppqppYC
CYppppppppppppYC
CYpppqpppqppppYC
CYppppppppppppYC
CYpqpppqpppqppYC
CYppppppppppppYC
CYpppqpppqppppYC
CYppppppppppppYC
CYpqpppqpppqppYC
CYppppppppppppYC
CYYYYYYYYYYYYYYC
CCCCCCCCCCCCCCCC
................
""")
# 7 desk with the journal (the book you click)
tile("""
................
.KKKKKKKKKKKKKK.
.KLLLLLLLLLLLLK.
.KLLKKKKKKKLLLK.
.KLLKRRRRRKLLLK.
.KLLKRYYYRKLLLK.
.KLLKRRRRRKlLLK.
.KLLKKKKKKKLLLK.
.KLLLLLLLLLLLLK.
.KMMMMMMMMMMMMK.
.KDDDDDDDDDDDDK.
.KD.........DK..
.KD.........DK..
.KD.........DK..
.KK.........KK..
................
""")
# 8 bed head (pillow)
tile("""
.KKKKKKKKKKKKKK.
.KDDDDDDDDDDDDK.
.KDMMMMMMMMMMDK.
.KDKKKKKKKKKKDK.
.KDKWWWWWWWWKDK.
.KDKWwwwwwwWKDK.
.KDKWWWWWWWWKDK.
.KDKKKKKKKKKKDK.
.KDhhhhhhhhhhDK.
.KDGGGGGGGGGGDK.
.KDGgGGGGGGgGDK.
.KDGGGGGGGGGGDK.
.KDGGGGgGGGGGDK.
.KDGGGGGGGGGGDK.
.KDGgGGGGGGgGDK.
.KDGGGGGGGGGGDK.
""")
# 9 bed foot (blanket + frame)
tile("""
.KDGGGGGGGGGGDK.
.KDGGGGgGGGGGDK.
.KDGGGGGGGGGGDK.
.KDGgGGGGGGgGDK.
.KDGGGGGGGGGGDK.
.KDGGGGGGGGGGDK.
.KDGGGGgGGGGGDK.
.KDhhhhhhhhhhDK.
.KDDDDDDDDDDDDK.
.KDMMMMMMMMMMDK.
.KDDDDDDDDDDDDK.
.KKKKKKKKKKKKKK.
.KD..........DK.
.KK..........KK.
................
................
""")
# 10 bookshelf
tile("""
KKKKKKKKKKKKKKKK
KDDDDDDDDDDDDDDK
KDRRCCYGGRRYCCDK
KDRRCCYGGRRYCCDK
KDRRCCYGGRRYCCDK
KDDDDDDDDDDDDDDK
KDGYYRRCCGGYRRDK
KDGYYRRCCGGYRRDK
KDGYYRRCCGGYRRDK
KDDDDDDDDDDDDDDK
KDCCRRGGYYCCRGDK
KDCCRRGGYYCCRGDK
KDCCRRGGYYCCRGDK
KDDDDDDDDDDDDDDK
KKKKKKKKKKKKKKKK
................
""")
# 11 chest
tile("""
................
................
................
..KKKKKKKKKKKK..
..KMMMMMMMMMMK..
..KMLLLLLLLLMK..
..KMMMMMMMMMMK..
..KKKKKYYKKKKK..
..KDDDDYYDDDDK..
..KDMMMMMMMMDK..
..KDMLLLLLLMDK..
..KDMMMMMMMMDK..
..KDDDDDDDDDDK..
..KKKKKKKKKKKK..
................
................
""")


def main() -> None:
    img = Image.new("RGBA", (16 * len(TILES), 16), (0, 0, 0, 0))
    for i, rows in enumerate(TILES):
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                c = P[ch]
                if c:
                    img.putpixel((i * 16 + x, y), tuple(int(c[k : k + 2], 16) for k in (1, 3, 5)) + (255,))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT)
    print("wrote", OUT.relative_to(ROOT), img.size)


if __name__ == "__main__":
    main()
