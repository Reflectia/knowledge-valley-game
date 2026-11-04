"""Draw temporary interior tiles for the heroine's house (16×16, design-system palette).

Run from the repo root:  python scripts/assets/draw_interior.py
Writes public/assets/_temp/interior/interior-16.png and shop-stall.png. Placeholder art, listed in ASSETS-TODO.md.

Tile order (frame index):
  0 floor          1 floor (knot)    2 log wall        3 log wall + baseboard
  4 wall + window  5 door mat (exit) 6 rug             7 desk with the journal
  8 bed (head)     9 bed (foot)     10 bookshelf      11 chest
 12 garden soil   13 garden soil, watered
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
    "s": "#6b4a2b",  # forest-earth (soil)
    "S": "#4f3420",  # soil furrow (darker forest-earth)
    "e": "#9a6b3f",  # forest-detail (soil highlight)
    "u": "#4a3422",  # wet soil
    "U": "#33231a",  # wet furrow
    "v": "#6b4a2b",  # wet highlight
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

# 12 garden soil (tilled furrows)
tile("""
.SSSSSSSSSSSSSS.
SseesssseessseeS
SssssssssssssssS
SSSSSSSSSSSSSSSS
SsesssessssesssS
SssssssssssssssS
SSSSSSSSSSSSSSSS
SssesssssessessS
SssssssssssssssS
SSSSSSSSSSSSSSSS
SseessesssseessS
SssssssssssssssS
SSSSSSSSSSSSSSSS
SsssesssesssessS
SssssssssssssssS
.SSSSSSSSSSSSSS.
""")
# 13 garden soil, watered (darker)
tile("""
.UUUUUUUUUUUUUU.
UuvvuuuuvvuuuvvU
UuuuuuuuuuuuuuuU
UUUUUUUUUUUUUUUU
UuvuuuvuuuuvuuuU
UuuuuuuuuuuuuuuU
UUUUUUUUUUUUUUUU
UuuvuuuuuvuuvuuU
UuuuuuuuuuuuuuuU
UUUUUUUUUUUUUUUU
UuvvuuvuuuuvvuuU
UuuuuuuuuuuuuuuU
UUUUUUUUUUUUUUUU
UuuuvuuuvuuuvuuU
UuuuuuuuuuuuuuuU
.UUUUUUUUUUUUUU.
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


# ------------------------------------------------------------------ shop stall (32×32)

STALL_OUT = ROOT / "public/assets/_temp/interior/shop-stall.png"


def hexrgb(h: str) -> tuple[int, int, int, int]:
    return tuple(int(h[k : k + 2], 16) for k in (1, 3, 5)) + (255,)


def draw_stall() -> None:
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    put = lambda x, y, c: img.putpixel((x, y), hexrgb(P[c]))
    # Posts
    for y in range(8, 32):
        for x in (2, 3, 28, 29):
            put(x, y, "D" if x in (2, 28) else "M")
    # Striped awning with a scalloped edge (honey / parchment, outlined in wood)
    for y in range(1, 9):
        for x in range(0, 32):
            put(x, y, "Y" if (x // 4) % 2 == 0 else "W")
    for x in range(0, 32):
        put(x, 0, "K")
        if x % 4 in (1, 2):
            put(x, 9, "Y" if (x // 4) % 2 == 0 else "W")
        put(x, 8 if x % 4 in (0, 3) else 10, "K")  # scallop outline
    # Counter
    for y in range(20, 31):
        for x in range(1, 31):
            put(x, y, "M")
    for x in range(1, 31):
        put(x, 20, "L")
        put(x, 31, "K")
        put(x, 25, "D")
    for y in range(20, 32):
        put(0, y, "K")
        put(31, y, "K")
    # Goods on the counter: turnips, tomatoes, a seed bag
    for x, c in ((6, "C"), (8, "C"), (12, "G"), (13, "g"), (18, "Y"), (19, "y"), (23, "C"), (25, "G")):
        put(x, 19, c)
        put(x, 18, c)
        put(x + 1, 19, c)
    img.save(STALL_OUT)
    print("wrote", STALL_OUT.relative_to(ROOT))




# ------------------------------------------------------------------ mailbox (16×32, flag down / up)

MAILBOX_OUT = ROOT / "public/assets/_temp/interior/mailbox.png"


def draw_mailbox() -> None:
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))  # two frames side by side
    for frame in (0, 1):
        ox = frame * 16
        put = lambda x, y, c: img.putpixel((ox + x, y), hexrgb(P[c]))
        # Post
        for y in range(14, 31):
            put(7, y, "D")
            put(8, y, "M")
        for x in range(5, 11):
            put(x, 31, "K")
        # Box: wood-500 body, rounded top, darker outline, slot
        for y in range(6, 15):
            for x in range(2, 14):
                put(x, y, "M")
        for x in range(3, 13):
            put(x, 5, "K")
        for x in range(2, 14):
            put(x, 15, "K")
        for y in range(6, 15):
            put(1, y, "K")
            put(14, y, "K")
        for x in range(3, 13):
            put(x, 6, "L")
        for x in range(4, 9):
            put(x, 9, "K")
        # Flag: down (frame 0) along the side, up (frame 1) raised in clay-600
        if frame == 0:
            for y in range(10, 14):
                put(15, y, "C")
        else:
            for y in range(1, 10):
                put(15, y, "D")
            for y in range(1, 4):
                for x in range(12, 15):
                    put(x, y, "C")
    img.save(MAILBOX_OUT)
    print("wrote", MAILBOX_OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
    draw_stall()
    draw_mailbox()
