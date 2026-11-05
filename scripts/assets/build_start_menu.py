"""Start menu art from the owner's images (backdrops/start-menu-*-new.jpg).

Run from the repo root:  python scripts/assets/build_start_menu.py

- start-bg.png     the valley backdrop (start-menu-new.jpg), one pixel per art cell
- start-title.png  the game title, keyed out of the sky in start-menu-interface-new.jpg
                   (the assets sheet draws it on a plaque; the ready reference has none)
- start-panel.png  9-slice panel frame from a button on start-menu-assets-new.jpg;
                   its centre (text and icons) is filled with the plain parchment colour
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from pixelize import assign, grid_phase, grid_pixelize, kmeans_colors, load_rgb, to_image  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "images/backdrops"
OUT = ROOT / "public/assets/ui"

# 9-slice insets of start-panel.png (top, right, bottom, left), in art pixels.
# Mirrored in src/styles/app.css (.start-menu__panel).
PANEL_SLICE = (18, 16, 19, 17)


def save(im: Image.Image, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    im.save(OUT / name)
    print(f"  ui/{name:28s} {im.width}x{im.height}")


def cells(src: np.ndarray, box: tuple[int, int, int, int], period: float) -> tuple[np.ndarray, np.ndarray]:
    """Median colour of each art cell's core, plus the cell boxes (for masks)."""
    l, t, r, b = box
    crop = src[t:b, l:r].astype(np.float64)
    gray = crop.mean(2)
    ox, oy = grid_phase(gray, period, 1), grid_phase(gray, period, 0)
    nx, ny = int((crop.shape[1] - ox) // period), int((crop.shape[0] - oy) // period)
    xs = (ox + np.arange(nx + 1) * period).round().astype(int)
    ys = (oy + np.arange(ny + 1) * period).round().astype(int)
    col = np.zeros((ny, nx, 3))
    for j in range(ny):
        for i in range(nx):
            core = crop[ys[j] + 1 : ys[j + 1] - 1, xs[i] + 1 : xs[i + 1] - 1]
            col[j, i] = np.median(core.reshape(-1, 3), 0)
    centers = np.stack(np.meshgrid((xs[:-1] + xs[1:]) / 2 + l, (ys[:-1] + ys[1:]) / 2 + t), -1)
    return col, centers


def keyed(col: np.ndarray, mask: np.ndarray, colors: int) -> Image.Image:
    pal = kmeans_colors(col[mask], colors)
    idx = assign(col.reshape(-1, 3), pal).reshape(mask.shape)
    idx[~mask] = -1
    im = to_image(idx, pal)
    return im.crop(im.getbbox())


def backdrop() -> None:
    src = load_rgb(str(SRC / "start-menu-new.jpg"))
    h, w = src.shape[:2]
    save(grid_pixelize(src, (0, 0, w, h), 5.78, 64), "start-bg.png")


def title() -> None:
    src = load_rgb(str(SRC / "start-menu-interface-new.jpg")).astype(np.float64)
    box = (790, 50, 2010, 540)
    col, centers = cells(src, box, 5.71)
    # The sky behind the title: per row, the median of clear bands left and right of it,
    # blended across. Cells far from it are the lettering, vines and sparkles.
    t, b = box[1], box[3]
    left = np.median(src[t:b, 725:785], axis=1)
    right = np.median(src[t:b, 2015:2190], axis=1)
    ry = centers[..., 1].astype(int) - t
    wx = ((centers[..., 0] - box[0]) / (box[2] - box[0]))[..., None]
    sky = left[ry] * (1 - wx) + right[ry] * wx
    mask = np.sqrt(((col - sky) ** 2).sum(2)) > 45
    save(keyed(col, mask, 24), "start-title.png")


def panel() -> None:
    src = load_rgb(str(SRC / "start-menu-assets-new.jpg")).astype(np.float64)
    # The «Нова гра» button; the navy sheet background is keyed out.
    col, _ = cells(src, (1050, 585, 1750, 925), 5.78)
    navy = np.median(src[500:560, 900:1000].reshape(-1, 3), 0)
    im = keyed(col, np.sqrt(((col - navy) ** 2).sum(2)) > 40, 24)
    a = np.asarray(im).copy()
    top, right, bottom, left = PANEL_SLICE
    parchment = np.array([208, 162, 113, 255], dtype=np.uint8)
    a[top : a.shape[0] - bottom, left : a.shape[1] - right] = parchment
    save(Image.fromarray(a), "start-panel.png")


def main() -> None:
    print("start menu")
    backdrop()
    title()
    panel()


if __name__ == "__main__":
    main()
