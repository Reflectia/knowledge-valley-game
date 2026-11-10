"""Cut the owner's new images into native-size game sprites.

Run from the repo root:  python scripts/assets/build_sprites.py
Outputs go to public/assets/. Coordinates are source pixels of each JPG.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from pixelize import Region, load_rgb, pixelize  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
IMG = ROOT / "images"
OUT = ROOT / "public/assets"


def save(im: Image.Image, rel: str) -> None:
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path)
    print(f"  {rel:40s} {im.width}x{im.height}")


def replace_green(im: Image.Image, rgb: tuple[int, int, int]) -> Image.Image:
    a = np.asarray(im).copy()
    r, g, b = (a[..., i].astype(int) for i in range(3))
    m = (a[..., 3] > 0) & (g > r + 10) & (g > b + 10)
    a[m, :3] = rgb
    return Image.fromarray(a, "RGBA")


def card(cols, rows, r, c, inset):
    (x0, x1), (y0, y1) = cols[c], rows[r]
    return (x0 + inset, y0 + inset, x1 - inset, y1 - inset)


# --------------------------------------------------------------------------- enemies


def enemies() -> None:
    print("enemies")
    src = load_rgb(str(IMG / "enemies/enemies_new.jpg"))
    cols = [(27, 585), (624, 1181), (1219, 1776), (1815, 2373)]
    rows = [(20, 881), (912, 1780)]
    names = [["beetle", "deadline", "ghost", "magpie"], ["moth", "slime", "sprout", "wisp"]]
    for r in range(2):
        for c in range(4):
            reg = Region(card(cols, rows, r, c, 25), bg_tolerance=30)
            save(pixelize(src, reg, (16, 16), colors=12, anchor="bottom"), f"enemies/{names[r][c]}.png")


# --------------------------------------------------------------------------- items


def items() -> None:
    print("items")
    src = load_rgb(str(IMG / "items/items-new.jpg"))
    cols = [(24, 1176), (1224, 2376)]
    rows = [(20, 872), (920, 1772)]
    names = [["book", "potion"], ["seed", "staff"]]
    for r in range(2):
        for c in range(2):
            reg = Region(card(cols, rows, r, c, 30), bg_tolerance=45)
            # Icons occupy 14×14 with 1 px of air (ItemIcons README).
            save(pixelize(src, reg, (16, 16), colors=10, fit=(14, 14), anchor="center"), f"items/{names[r][c]}.png")


# --------------------------------------------------------------------------- portraits


def portraits() -> None:
    print("portraits")
    src = load_rgb(str(IMG / "portraits/Gemini_Generated_Image_pxt3m5pxt3m5pxt3.jpg"))
    cols = [(23, 793), (827, 1596), (1620, 2377)]
    rows = [(19, 861), (908, 1736)]
    # Decisions: cut with frames; the sixth image is the heraldic emblem.
    names = [["mentor-forest", "mentor-forge", "mentor-library"], ["mentor-market", "mentor-tower", "emblem"]]
    for r in range(2):
        for c in range(3):
            reg = Region(card(cols, rows, r, c, 0), bg_tolerance=30)
            im = pixelize(src, reg, (64, 64), colors=32, anchor="center", dark_weight=1.5)
            save(im, f"portraits/{names[r][c]}.png")


# --------------------------------------------------------------------------- start menu


def start_menu() -> None:
    print("start menu")
    src = load_rgb(str(IMG / "backdrops/start-menu-cursor-new.jpg"))
    # The backdrop, title and panel come from build_start_menu.py.
    # Sword cursor from the right panel; tip at the top-left = hotspot (0, 0).
    reg = Region((2080, 300, 2752, 1236), bg_tolerance=40)
    sword = pixelize(src, reg, (16, 16), colors=10, anchor="center", dark_weight=2.0)
    a = np.asarray(sword)
    ys, xs = np.nonzero(a[..., 3])
    sword = sword.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    canvas = Image.new("RGBA", (16, 16))
    canvas.alpha_composite(sword, (0, 0))
    save(canvas, "ui/cursor-sword-16.png")
    # Browsers do not scale cursor images, so ship the ×2 version used at UI scale ×2.
    save(canvas.resize((32, 32), Image.NEAREST), "ui/cursor-sword-32.png")


# --------------------------------------------------------------------------- homestead


HOMESTEAD_GRASS_PAL = {
    '.': (91, 156, 64), 'v': (53, 103, 66), 'm': (70, 125, 62), 'l': (135, 195, 77),
    'p': (214, 148, 178), 'c': (240, 232, 176), 'y': (226, 206, 96),
}
HOMESTEAD_PATH_PAL = {
    '.': (157, 111, 65), 'd': (138, 94, 56), 'e': (118, 84, 58),
    'S': (180, 174, 142), 's': (155, 151, 121), 'o': (100, 78, 60),
}
HOMESTEAD_TILES = {
    # plain grass with a few tufts
    "grass": [
        "................",
        "...........l....",
        "..v.............",
        ".vmv............",
        "........m.......",
        "................",
        ".............v..",
        "............vmv.",
        "....l...........",
        "................",
        "......v.........",
        ".....vmv.....l..",
        "................",
        "..m.............",
        "..........v.....",
        "................",
    ],
    # the same grass with three small flowers (scattered between plain grass)
    "grass-flowers": [
        "................",
        "................",
        "...p............",
        "..pyp.......v...",
        "...p.......vmv..",
        "................",
        "........c.......",
        ".......cyc......",
        "..l.....c.......",
        "................",
        "............p...",
        "...v.......pyp..",
        "..vmv.......p...",
        "................",
        "......l.........",
        "................",
    ],
    # dirt path with two pebbles
    "path": [
        "................",
        "....d.......e...",
        "..........SS....",
        ".........Ssso...",
        "..e.......oo....",
        "................",
        "......d.........",
        "..............d.",
        ".d..........e...",
        "................",
        "...Ss...........",
        "...so....d......",
        "................",
        "..........e.....",
        "......d.........",
        "..............e.",
    ],
}


def homestead() -> None:
    """Objects and tiles for the homestead, cut from the day half at 1/8 scale.

    1/8 keeps the door about as tall as the heroine (16×32). The night half
    gives the lit window overlay; the rest of the night look is done by the
    lighting system (light-night multiply + warm light sources).
    """
    print("homestead")
    src = load_rgb(str(IMG / "lighting/homestead-day-night-new.jpg"))
    s = 8
    k = 1.068  # display → source factor used when the boxes were measured

    def box(x0, y0, x1, y1):
        return tuple(int(round(v * k)) for v in (x0, y0, x1, y1))

    objects = {
        "house": (box(95, 10, 770, 900), 32),
        "tree-blossom-a": (box(790, 200, 1070, 530), 20),
        "tree-blossom-b": (box(995, 655, 1278, 980), 20),
        "lamp-post": (box(885, 550, 1005, 980), 12),
    }
    meta: dict[str, dict] = {}
    for name, (b, colors) in objects.items():
        reg = Region(b, bg_mode="green")
        im = pixelize(src, reg, None, colors=colors, scale=s, anchor="bottom", min_speck=6)
        if name == "lamp-post":
            im = replace_green(im, (58, 66, 78))  # grass seen through the lantern glass
        save(im, f"homestead/{name}.png")
        meta[name] = {"w": im.width, "h": im.height}

    # Tiles 16×16, hand-drawn in the scene's colors: cut from the scene they were not seamless
    # and read as noise once repeated. Nothing touches the tile border, so they repeat cleanly.
    sheet = Image.new("RGBA", (16 * len(HOMESTEAD_TILES), 16))
    for i, (name, rows) in enumerate(HOMESTEAD_TILES.items()):
        assert len(rows) == 16 and all(len(r) == 16 for r in rows), name
        pal = HOMESTEAD_PATH_PAL if name == "path" else HOMESTEAD_GRASS_PAL
        im = Image.fromarray(np.array([[(*pal[c], 255) for c in r] for r in rows], np.uint8), "RGBA")
        sheet.alpha_composite(im, (16 * i, 0))
    save(sheet, "homestead/homestead-tiles-16.png")
    meta["tiles"] = {"order": list(HOMESTEAD_TILES)}

    # Lit window for the night; same box on the night half (offset 1295 display px).
    day_window = box(230, 615, 372, 768)
    night_window = box(230 + 1295, 615, 372 + 1295, 768)
    lit = pixelize(src, Region(night_window, remove_bg=False), None, colors=8, scale=s)
    save(lit, "homestead/window-lit.png")
    house_origin = box(95, 10, 770, 900)
    meta["window-lit"] = {
        "w": lit.width,
        "h": lit.height,
        # Position inside the house sprite (approximate; house sprite is trimmed).
        "x": round((day_window[0] - house_origin[0]) / s),
        "y": round((day_window[1] - house_origin[1]) / s),
    }
    (OUT / "homestead/homestead.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")


def main() -> None:
    which = set(sys.argv[1:]) or {"enemies", "items", "portraits", "start", "homestead"}
    if "enemies" in which:
        enemies()
    if "items" in which:
        items()
    if "portraits" in which:
        portraits()
    if "start" in which:
        start_menu()
    if "homestead" in which:
        homestead()


if __name__ == "__main__":
    main()
