"""Comparison sheet: design-system PNG (left) vs. sprite cut from the new image (right).

Run from the repo root:  python scripts/assets/preview.py
Writes docs/assets-preview.png (×4, nearest neighbor).
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OLD = ROOT / "images"
NEW = ROOT / "public/assets"
S = 4
BG = (46, 27, 18, 255)  # wood-900
GAP = 6


def load(p: Path) -> Image.Image:
    return Image.open(p).convert("RGBA")


def row(pairs: list[tuple[Image.Image | None, Image.Image]]) -> Image.Image:
    w = sum((o.width if o else 0) + n.width + GAP * 2 for o, n in pairs) + GAP
    h = max(max(o.height if o else 0, n.height) for o, n in pairs) + GAP * 2
    im = Image.new("RGBA", (w, h), BG)
    x = GAP
    for old, new in pairs:
        if old:
            im.alpha_composite(old, (x, GAP))
            x += old.width + 2
        im.alpha_composite(new, (x, GAP))
        x += new.width + GAP * 2
    return im


def main() -> None:
    rows: list[tuple[str, Image.Image]] = []
    enemies = ["beetle", "deadline", "ghost", "magpie", "moth", "slime", "sprout", "wisp"]
    rows.append(("Вороги", row([(load(OLD / f"enemies/{e}-16.png"), load(NEW / f"enemies/{e}.png")) for e in enemies])))
    items = ["book", "potion", "seed", "staff"]
    rows.append(("Предмети", row([(load(OLD / f"items/{i}-16.png"), load(NEW / f"items/{i}.png")) for i in items])))
    biomes = ["forest", "forge", "library", "market", "tower"]
    rows.append(
        (
            "Наставники",
            row(
                [(load(OLD / f"portraits/mentor-{b}-64.png"), load(NEW / f"portraits/mentor-{b}.png")) for b in biomes]
                + [(None, load(NEW / "portraits/emblem.png"))]
            ),
        )
    )
    old_h = load(OLD / "characters/heroine-front-back-side-16x32.png")
    rows.append(("Героїня (старе | нове: 4 кадри × 3 напрямки)", row([(old_h, load(NEW / "characters/heroine.png"))])))
    home = ["house", "tree-blossom-a", "tree-blossom-b", "lamp-post", "window-lit", "homestead-tiles-16"]
    rows.append(("Садиба (нове)", row([(None, load(NEW / f"homestead/{h}.png")) for h in home])))
    rows.append(("Курсор (нове)", row([(None, load(NEW / "ui/cursor-sword-16.png"))])))

    label_h = 14
    width = max(r.width for _, r in rows)
    height = sum(r.height + label_h for _, r in rows)
    sheet = Image.new("RGBA", (width, height), BG)
    y = 0
    labels = []
    for label, r in rows:
        labels.append((y, label))
        sheet.alpha_composite(r, (0, y + label_h))
        y += r.height + label_h
    big = sheet.resize((width * S, height * S), Image.NEAREST)
    d = ImageDraw.Draw(big)
    try:  # Pillow's default bitmap font has no Cyrillic.
        font = ImageFont.truetype("arial.ttf", 32)
    except OSError:
        font = ImageFont.load_default()
    for y, label in labels:
        d.text((GAP * S, y * S + 8), label, fill=(248, 233, 196, 255), font=font)
    out = ROOT / "docs/assets-preview.png"
    big.save(out)
    print("wrote", out.relative_to(ROOT))


if __name__ == "__main__":
    main()
