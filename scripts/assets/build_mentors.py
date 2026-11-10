"""Mentor world sprites, 16x32, drawn by hand after the dialog portraits.

The portraits (public/assets/portraits/mentor-<pack>.png) are 64x64 busts; in the world each mentor
stands as a small front-facing figure the size of the heroine (16x32, feet on the bottom row).

Run from the repo root:
    python scripts/assets/build_mentors.py            -> public/assets/mentors/<pack>.png
    python scripts/assets/build_mentors.py --review   -> images/mentors-review/ (sprites + preview)
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "assets" / "mentors"
REVIEW = ROOT / "images" / "mentors-review"

MENTORS = {
    # elf druid: long dark-green hair, flower crown, pointed ears, green dress
    "forest": {
        "pal": {
            'o': (24, 44, 30), 'p': (238, 150, 182), 'w': (250, 242, 230), 'h': (96, 168, 92),
            'H': (46, 104, 58), 's': (252, 216, 184), 'S': (230, 172, 142), 'e': (34, 70, 44),
            'b': (240, 156, 156), 'L': (156, 212, 112), 'G': (76, 150, 70), 'D': (46, 102, 50),
            'f': (100, 66, 44),
        },
        "rows": [
            "....oooooooo....",
            "...opwhpwhpwo...",
            "..oHHHHHHHHHHo..",
            "..oHHhHHHHhHHo..",
            "..oHssssssssHo..",
            "s.HHssssssssHH.s",
            ".sHHseesseesHHs.",
            "..HHsbssssbsHH..",
            "..HHSssssssSHH..",
            "..HHHSSSSSSHHH..",
            "..HHHoLLLLoHHH..",
            ".HHHoGLLLLGoHHH.",
            ".HHoGGGLLGGGoHH.",
            ".HHoGGGGGGGGoHH.",
            ".HoGGGGGGGGGGoH.",
            "..osGGGGGGGGso..",
            "..oGGGDGGDGGGo..",
            "..oGGGDGGDGGGo..",
            "..oGGDGGGGDGGo..",
            ".oGGGDGGGGDGGGo.",
            ".oGGDGGGGGGDGGo.",
            ".oGDGGGGGGGGDGo.",
            "oGGDGGGGGGGGDGGo",
            "oGDGGGGGGGGGGDGo",
            "oDDDDDDDDDDDDDDo",
            ".oooooooooooooo.",
            "....ofo..ofo....",
            "....ooo..ooo....",
        ],
    },
    # mechanical owl: brown feathers, round gold glasses, big blue eyes, orange beak
    "tower": {
        "pal": {
            'o': (40, 26, 20), 'B': (150, 100, 60), 'b': (108, 68, 40), 'L': (222, 194, 146),
            'l': (178, 136, 88), 'W': (236, 236, 244), 'E': (70, 132, 204), 'P': (20, 20, 40),
            'G': (222, 180, 80), 'K': (240, 150, 50), 'F': (236, 160, 64),
        },
        "rows": [
            "...oo......oo...",
            "..obBo....oBbo..",
            "..obBBooooBBbo..",
            ".obBBBBBBBBBBbo.",
            ".oBGGGGBBGGGGBo.",
            "obGWWWWGGWWWWGbo",
            "obGWEEWGGWEEWGbo",
            "obGWEPWGGWPEWGbo",
            "obBGGGGBBGGGGBbo",
            "obBBBBBKKBBBBBbo",
            "obBBBBBBKBBBBBbo",
            "obBBLLLLLLLLBBbo",
            "obBLLlLLlLLLLBbo",
            "obBLLLLlLLlLLBbo",
            "obbLlLLLLlLLLbbo",
            "obbLLLlLLLLlLbbo",
            ".obbLLLLLLLLbbo.",
            ".obbbLLLLLLbbbo.",
            "..obbbbbbbbbbo..",
            "...oooooooooo...",
            "....FoF..FoF....",
            "....F.F..F.F....",
        ],
    },
    # fox merchant: top hat with a leaf, orange fur, white muzzle, red coat with gold buttons
    "market": {
        "pal": {
            'o': (40, 22, 20), 'k': (44, 36, 40), 'n': (110, 70, 44), 'V': (110, 180, 70),
            'F': (228, 122, 50), 'f': (172, 82, 32), 'W': (246, 236, 222), 'E': (30, 22, 22),
            'N': (20, 16, 16), 'R': (176, 42, 42), 'r': (122, 26, 32), 'Y': (236, 196, 80),
        },
        "rows": [
            ".....oooooo.....",
            ".....okkkkoV....",
            ".....okkkkoVV...",
            ".....onnnno.....",
            "..okkkkkkkkkko..",
            ".ofFFFFFFFFFFfo.",
            ".ofFFFFFFFFFFfo.",
            ".oFFEFFFFFFEFFo.",
            ".oFWFFFFFFFFWFo.",
            ".oWWWFFFFFFWWWo.",
            "..oWWWWNNWWWWo..",
            "...oWWWWWWWWo...",
            "....oWWWWWWo....",
            "...oRRWWWWRRo...",
            "..oRRRWWWWRRRo..",
            ".oRRRrRWWRrRRRo.",
            ".oRRRrRRYRrRRRo.",
            "oFRRRrRRRRrRRRFo",
            "oFRRRrRRYRrRRRFo",
            ".oRRRrRRRRrRRRo.",
            ".oRRRrRRYRrRRRo.",
            ".orrrrrrrrrrrro.",
            "..onnnnnnnnnnoFo",
            "..onnno..onnnoFW",
            "..onnno..onnno..",
            "..onnno..onnno..",
            "..okkko..okkko..",
            "..ooooo..ooooo..",
        ],
    },
    # dwarf smith: miner's helmet with a lamp, big red beard, blue shirt, belt, boots
    "forge": {
        "pal": {
            'o': (30, 22, 22), 'M': (70, 74, 84), 'm': (112, 116, 126), 'Y': (250, 222, 92),
            'S': (240, 190, 150), 's': (210, 150, 115), 'E': (30, 20, 20), 'R': (200, 82, 40),
            'r': (150, 50, 26), 'q': (232, 124, 62), 'U': (62, 92, 152), 'u': (40, 60, 112),
            'n': (100, 60, 40), 'b': (222, 180, 80), 'k': (62, 42, 30),
        },
        "rows": [
            "....oooooooo....",
            "...ommmYYmmmo...",
            "..oMMMMYYMMMMo..",
            ".oMMMMMMMMMMMMo.",
            ".oooooooooooooo.",
            "..oSSSSSSSSSSo..",
            "..oSESSSSSSESo..",
            ".rRSSSSssSSSSRr.",
            ".rRRqRRRRRRqRRr.",
            ".rRRRqRRRRqRRRr.",
            "orRRRRRRRRRRRRro",
            "oURRqRRRRRRqRRUo",
            "oUrRRRqRRqRRRrUo",
            "oUUrRRRRRRRRrUUo",
            "oSUUrRRqqRRrUUSo",
            ".oUUUrRRRRrUUUo.",
            ".oUUUUrRRrUUUUo.",
            ".onnnnnnbnnnnno.",
            ".ouuuuuuuuuuuuo.",
            ".ouuuuo..ouuuuo.",
            ".ouuuuo..ouuuuo.",
            ".okkkko..okkkko.",
            ".oooooo..oooooo.",
        ],
    },
    # old astronomer: grey bun, round gold glasses, navy robe with gold stars
    "library": {
        "pal": {
            'o': (30, 26, 40), 'A': (196, 196, 202), 'a': (146, 146, 156), 'S': (246, 206, 176),
            's': (220, 170, 140), 'G': (222, 172, 72), 'E': (40, 30, 30), 'b': (236, 152, 142),
            'N': (42, 48, 94), 'n': (28, 30, 62), 'Y': (242, 202, 92), 'k': (52, 40, 40),
        },
        "rows": [
            "......oooo......",
            ".....oAAAAo.....",
            "....ooAaaAoo....",
            "...oAAAAAAAAo...",
            "..oAAaAAAAaAAo..",
            "..oAASSSSSSAAo..",
            "..oASSSSSSSSAo..",
            "..oGGGGSSGGGGo..",
            "..oGESGGGGSEGo..",
            "..oSGGGSSGGGSo..",
            "..oSbSSSSSSbSo..",
            "...oSSSssSSSo...",
            "....oSSSSSSo....",
            "...onNNNNNNno...",
            "..onNNYNNNNNno..",
            "..oNNNNNNNYNNo..",
            ".onNNNNNNNNNNno.",
            ".oSNNYNNNNNNNSo.",
            ".onNNNNNNNYNNno.",
            ".onNNNNNNNNNNno.",
            ".onNYNNNNNNNNno.",
            "onNNNNNNNNYNNNno",
            "onNNNNNYNNNNNNno",
            "onNNNNNNNNNNNNno",
            "onnnnnnnnnnnnnno",
            ".oooooooooooooo.",
            "....oko..oko....",
            "....ooo..ooo....",
        ],
    },
}


def draw(spec) -> Image.Image:
    rows, pal = spec["rows"], spec["pal"]
    assert all(len(r) == 16 for r in rows), [len(r) for r in rows]
    assert len(rows) <= 32
    fig = np.array([[(*pal[c], 255) if c != '.' else (0, 0, 0, 0) for c in r] for r in rows], np.uint8)
    canvas = np.zeros((32, 16, 4), np.uint8)
    canvas[32 - len(rows):] = fig  # feet on the bottom row, like the heroine
    return Image.fromarray(canvas, "RGBA")


def review() -> None:
    REVIEW.mkdir(parents=True, exist_ok=True)
    portraits = ROOT / "public" / "assets" / "portraits"
    heroine = Image.open(ROOT / "public/assets/characters/heroine.png").convert("RGBA").crop((0, 0, 16, 32))
    s = 4
    cell_w = 64 + 8 + 16 * s
    sheet = Image.new("RGBA", (len(MENTORS) * (cell_w + 16) + 16 * s + 24, 32 * s + 16), (58, 94, 52, 255))
    x = 8
    for pack, spec in MENTORS.items():
        im = draw(spec)
        im.save(REVIEW / f"{pack}-16x32.png")
        portrait = Image.open(portraits / f"mentor-{pack}.png").convert("RGBA")
        sheet.alpha_composite(portrait, (x, 8 + 32 * s - 64))
        sheet.alpha_composite(im.resize((16 * s, 32 * s), Image.NEAREST), (x + 64 + 8, 8))
        x += cell_w + 16
    sheet.alpha_composite(heroine.resize((16 * s, 32 * s), Image.NEAREST), (x, 8))  # size reference
    sheet.save(REVIEW / "preview-x4.png")
    print("wrote", REVIEW)


def main() -> None:
    if "--review" in sys.argv:
        review()
        return
    OUT.mkdir(parents=True, exist_ok=True)
    for pack, spec in MENTORS.items():
        draw(spec).save(OUT / f"{pack}.png")
        print(f"  mentors/{pack}.png")


if __name__ == "__main__":
    main()
