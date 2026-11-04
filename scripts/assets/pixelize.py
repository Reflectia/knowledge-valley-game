"""Turn large AI-generated "pixel art" JPGs into true native-size sprites.

Pipeline for one region of a source sheet:
  1. crop the region;
  2. remove the background by flood fill from the crop border (so dark
     outlines inside the figure are kept);
  3. reduce colors with k-means on the full-resolution figure;
  4. downscale by majority vote per block (keeps crisp palette colors,
     no blending);
  5. optionally add a colored outline (a darker shade of the neighbor,
     never black) and place the result on the target canvas.

Only Pillow and numpy are needed.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
from PIL import Image

Anchor = Literal["bottom", "center"]


@dataclass
class Region:
    """A sprite region on a source sheet, in source pixels."""

    box: tuple[int, int, int, int]  # left, top, right, bottom
    # Background tolerance for flood fill (sum of |dr|+|dg|+|db|).
    bg_tolerance: int = 60
    # When False the crop is used as is (e.g. tiles, overlays).
    remove_bg: bool = True
    # "smooth": background is a soft gradient (sprite sheets on cards).
    # "green": background is textured grass (objects cut from a scene).
    bg_mode: Literal["smooth", "green"] = "smooth"


def green_mask(rgb: np.ndarray) -> np.ndarray:
    """Grass-colored pixels (green hue, saturated) connected to the crop border."""
    px = rgb.astype(np.float64) / 255
    mx, mn = px.max(2), px.min(2)
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    greenish = (g >= r * 0.95) & (g > b * 1.1) & (sat > 0.25)
    # Small flowers inside the grass count as grass too: close 1-pixel holes.
    cand = greenish.copy()
    for _ in range(3):
        grown = cand.copy()
        grown[1:] |= cand[:-1]
        grown[:-1] |= cand[1:]
        grown[:, 1:] |= cand[:, :-1]
        grown[:, :-1] |= cand[:, 1:]
        cand = grown & (greenish | (sat < 0.6))
    return _reach(cand)


def load_rgb(path: str) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB"))


def background_mask(rgb: np.ndarray, tolerance: int) -> np.ndarray:
    """True where the pixel is background connected to the crop border.

    Card backgrounds in the sources are soft vertical/radial gradients, so the
    background color is estimated per row from the left and right crop edges
    (plus a global estimate from the top and bottom edges), and a pixel is a
    background candidate when it is close to either. The mask is then limited
    to candidates connected to the border, so dark outlines inside the figure
    survive.
    """
    h, w, _ = rgb.shape
    px = rgb.astype(np.float64)
    edge_w = max(2, min(h, w) // 40)
    border = np.zeros((h, w), dtype=bool)
    border[:edge_w] = border[-edge_w:] = True
    border[:, :edge_w] = border[:, -edge_w:] = True

    # Smooth background model: quadratic in (x, y) per channel, fitted on the
    # border first, then refitted on everything classified as background.
    yy, xx = np.mgrid[0:h, 0:w]
    u, v = xx / w - 0.5, yy / h - 0.5
    basis = np.stack([np.ones_like(u), u, v, u * u, v * v, u * v], axis=-1)  # (h, w, 6)
    fit_mask = border
    for _ in range(3):
        a = basis[fit_mask]
        coef, *_ = np.linalg.lstsq(a, px[fit_mask], rcond=None)
        model = basis @ coef
        dist = np.abs(px - model).sum(2)
        cand = dist < tolerance
        fit_mask = cand & _reach(cand)
        if fit_mask.sum() < 100:
            break
    return _reach(cand)


def _reach(cand: np.ndarray) -> np.ndarray:
    """Candidates connected to the image border (4-neighborhood)."""
    reach = np.zeros_like(cand)
    reach[0, :] = cand[0, :]
    reach[-1, :] = cand[-1, :]
    reach[:, 0] |= cand[:, 0]
    reach[:, -1] |= cand[:, -1]
    while True:
        grown = reach.copy()
        grown[1:] |= reach[:-1]
        grown[:-1] |= reach[1:]
        grown[:, 1:] |= reach[:, :-1]
        grown[:, :-1] |= reach[:, 1:]
        grown &= cand
        if (grown == reach).all():
            return reach
        reach = grown


def kmeans_colors(pixels: np.ndarray, k: int, iters: int = 20, seed: int = 7) -> np.ndarray:
    """Plain k-means in RGB; returns (k, 3) float centers."""
    rng = np.random.default_rng(seed)
    pts = pixels.astype(np.float32)
    if len(pts) > 60000:
        sample = pts[rng.choice(len(pts), 60000, replace=False)]
    else:
        sample = pts
    k = min(k, len(np.unique(sample.astype(np.uint8), axis=0)))
    # k-means++ init
    centers = [sample[rng.integers(len(sample))]]
    for _ in range(1, k):
        d = np.min(((sample[:, None, :] - np.array(centers)[None]) ** 2).sum(2), axis=1)
        centers.append(sample[rng.choice(len(sample), p=d / d.sum())])
    c = np.array(centers)
    for _ in range(iters):
        lab = np.argmin(((sample[:, None, :] - c[None]) ** 2).sum(2), axis=1)
        for i in range(k):
            m = sample[lab == i]
            if len(m):
                c[i] = m.mean(0)
    return c


def assign(pixels: np.ndarray, centers: np.ndarray) -> np.ndarray:
    out = np.empty(len(pixels), dtype=np.int32)
    step = 200000
    for s in range(0, len(pixels), step):
        chunk = pixels[s : s + step].astype(np.float32)
        out[s : s + step] = np.argmin(((chunk[:, None, :] - centers[None]) ** 2).sum(2), axis=1)
    return out


def majority_downscale(
    labels: np.ndarray,
    opaque: np.ndarray,
    out_w: int,
    out_h: int,
    alpha_cut: float,
    palette: np.ndarray | None = None,
    dark_weight: float = 1.0,
) -> np.ndarray:
    """labels: (h, w) palette index; returns (out_h, out_w) index, -1 = transparent.

    Each output pixel takes the most common color of its block. With
    dark_weight > 1, colors much darker than the block average count more,
    so eyes and outlines smaller than one output pixel are not lost.
    """
    h, w = labels.shape
    ys = np.linspace(0, h, out_h + 1).round().astype(int)
    xs = np.linspace(0, w, out_w + 1).round().astype(int)
    out = np.full((out_h, out_w), -1, dtype=np.int32)
    lum = None if palette is None else palette @ np.array([0.299, 0.587, 0.114])
    n = int(labels.max()) + 1
    for j in range(out_h):
        for i in range(out_w):
            block_l = labels[ys[j] : ys[j + 1], xs[i] : xs[i + 1]]
            block_o = opaque[ys[j] : ys[j + 1], xs[i] : xs[i + 1]]
            if block_o.size == 0 or block_o.mean() < alpha_cut:
                continue
            vals = block_l[block_o]
            counts = np.bincount(vals, minlength=n).astype(np.float64)
            if lum is not None and dark_weight != 1.0:
                mean_lum = (counts * lum[:n]).sum() / counts.sum()
                darkness = np.clip((mean_lum - lum[:n]) / 80.0, 0, 1)
                counts *= 1 + (dark_weight - 1) * darkness
            out[j, i] = counts.argmax()
    return out


def darker(color: np.ndarray, amount: float = 0.45) -> np.ndarray:
    return np.clip(color * (1 - amount), 0, 255)


def add_outline(idx: np.ndarray, palette: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Recolor edge pixels (opaque next to transparent) with a darker shade of themselves.

    The outline sits on the sprite's own edge, so the silhouette size is unchanged.
    """
    h, w = idx.shape
    opaque = idx >= 0
    edge = np.zeros_like(opaque)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        shifted = np.zeros_like(opaque)
        ys = slice(max(dy, 0), h + min(dy, 0))
        yd = slice(max(-dy, 0), h + min(-dy, 0))
        xs = slice(max(dx, 0), w + min(dx, 0))
        xd = slice(max(-dx, 0), w + min(-dx, 0))
        shifted[yd, xd] = opaque[ys, xs]
        edge |= opaque & ~shifted
    pal = [tuple(c) for c in palette]
    new_idx = idx.copy()
    lum = palette @ np.array([0.299, 0.587, 0.114])
    for y, x in zip(*np.nonzero(edge)):
        c = palette[idx[y, x]]
        if lum[idx[y, x]] < 70:  # already an outline-dark color
            continue
        dc = tuple(darker(c))
        if dc not in pal:
            pal.append(dc)
        new_idx[y, x] = pal.index(dc)
    return new_idx, np.array(pal)


def drop_specks(idx: np.ndarray, min_size: int) -> np.ndarray:
    """Make opaque islands smaller than min_size pixels transparent (8-neighborhood)."""
    h, w = idx.shape
    seen = np.zeros((h, w), dtype=bool)
    out = idx.copy()
    for sy, sx in zip(*np.nonzero(idx >= 0)):
        if seen[sy, sx]:
            continue
        stack, comp = [(sy, sx)], []
        seen[sy, sx] = True
        while stack:
            y, x = stack.pop()
            comp.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and idx[ny, nx] >= 0:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
        if len(comp) < min_size:
            for y, x in comp:
                out[y, x] = -1
    return out


def to_image(idx: np.ndarray, palette: np.ndarray) -> Image.Image:
    h, w = idx.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    m = idx >= 0
    rgba[m, :3] = palette[idx[m]].round().astype(np.uint8)
    rgba[m, 3] = 255
    return Image.fromarray(rgba, "RGBA")


def figure(src: np.ndarray, region: Region) -> tuple[np.ndarray, np.ndarray]:
    """Crop a region and return (rgb, foreground mask), trimmed to the figure."""
    l, t, r, b = region.box
    crop = src[t:b, l:r]
    if region.remove_bg:
        bg = green_mask(crop) if region.bg_mode == "green" else background_mask(crop, region.bg_tolerance)
        fg = ~bg
        # Bounding box ignoring JPEG specks: rows/cols need a few fg pixels.
        min_px = max(3, min(fg.shape) // 150)
        rows = np.nonzero(fg.sum(1) >= min_px)[0]
        cols = np.nonzero(fg.sum(0) >= min_px)[0]
        y0, y1, x0, x1 = rows.min(), rows.max() + 1, cols.min(), cols.max() + 1
        crop = crop[y0:y1, x0:x1]
        fg = fg[y0:y1, x0:x1]
    else:
        fg = np.ones(crop.shape[:2], dtype=bool)
    return crop, fg


def shared_palette(figures: list[tuple[np.ndarray, np.ndarray]], colors: int) -> np.ndarray:
    """One k-means palette for several figures (e.g. all views of a character)."""
    return kmeans_colors(np.concatenate([rgb[fg] for rgb, fg in figures]), colors)


def pixelize(
    src: np.ndarray,
    region: Region,
    target: tuple[int, int] | None,
    *,
    colors: int = 14,
    palette: np.ndarray | None = None,
    fit: tuple[int, int] | None = None,
    scale: float | None = None,
    anchor: Anchor = "bottom",
    outline: bool = False,
    alpha_cut: float = 0.5,
    dark_weight: float = 1.0,
    min_speck: int = 0,
) -> Image.Image:
    """Make one native-size RGBA sprite.

    target: final canvas size (w, h).
    fit: max size of the figure inside the canvas (defaults to target).
    scale: source pixels per output pixel; overrides fit (keeps views consistent).
    palette: fixed colors to use instead of a per-sprite k-means.
    """
    crop, fg = figure(src, region)

    h, w = fg.shape
    if scale is None:
        fw, fh = fit or target
        scale = max(w / fw, h / fh)
    out_w, out_h = max(1, round(w / scale)), max(1, round(h / scale))
    if target is None:  # tight canvas around the figure
        target = (out_w, out_h)

    centers = palette if palette is not None else kmeans_colors(crop[fg], colors)
    labels = np.zeros(fg.shape, dtype=np.int32)
    labels[fg] = assign(crop[fg], centers)
    idx = majority_downscale(labels, fg, out_w, out_h, alpha_cut, centers, dark_weight)
    if min_speck:
        idx = drop_specks(idx, min_speck)
    palette = centers
    if outline:
        idx, palette = add_outline(idx, palette)

    tw, th = target
    canvas = np.full((th, tw), -1, dtype=np.int32)
    # Clip if the figure is larger than the canvas (can happen with a fixed scale).
    cw, ch = min(out_w, tw), min(out_h, th)
    sx, sy = (out_w - cw) // 2, out_h - ch if anchor == "bottom" else (out_h - ch) // 2
    ox = (tw - cw) // 2
    oy = th - ch if anchor == "bottom" else (th - ch) // 2
    canvas[oy : oy + ch, ox : ox + cw] = idx[sy : sy + ch, sx : sx + cw]
    return to_image(canvas, palette)


def grid_phase(gray: np.ndarray, period: float, axis: int) -> float:
    """Offset (0..period) of the art pixel grid along an axis, from the FFT phase of edges."""
    edges = np.abs(np.diff(gray, axis=axis)).sum(axis=1 - axis)
    n = np.arange(len(edges))
    z = (edges * np.exp(-2j * np.pi * n / period)).sum()
    # Edges sit at cell boundaries; +0.5 because diff index i is between i and i+1.
    return float((-np.angle(z) / (2 * np.pi) * period + 0.5) % period)


def grid_pixelize(src: np.ndarray, box: tuple[int, int, int, int], period: float, colors: int) -> Image.Image:
    """Sample an image drawn on a regular art-pixel grid back to one pixel per cell."""
    l, t, r, b = box
    crop = src[t:b, l:r]
    gray = crop.astype(np.float64).mean(2)
    ox, oy = grid_phase(gray, period, 1), grid_phase(gray, period, 0)
    # Only whole cells: partial cells at the crop edges are dropped.
    nx = int((crop.shape[1] - ox) // period)
    ny = int((crop.shape[0] - oy) // period)
    xs = (ox + np.arange(nx + 1) * period).round().astype(int)
    ys = (oy + np.arange(ny + 1) * period).round().astype(int)
    centers = kmeans_colors(crop.reshape(-1, 3), colors)
    labels = assign(crop.reshape(-1, 3), centers).reshape(crop.shape[:2])
    out = np.zeros((len(ys) - 1, len(xs) - 1), dtype=np.int32)
    for j in range(len(ys) - 1):
        for i in range(len(xs) - 1):
            # Sample the cell's core to avoid JPEG ringing at its borders.
            y0, y1, x0, x1 = ys[j], ys[j + 1], xs[i], xs[i + 1]
            my, mx = max(1, (y1 - y0) // 4), max(1, (x1 - x0) // 4)
            core = labels[y0 + my : max(y0 + my + 1, y1 - my), x0 + mx : max(x0 + mx + 1, x1 - mx)]
            out[j, i] = np.bincount(core.ravel()).argmax()
    return to_image(out, centers)


def contact_sheet(images: list[Image.Image], scale: int = 8, gap: int = 2, bg=(46, 27, 18)) -> Image.Image:
    """Preview helper: images side by side, nearest-neighbor upscaled."""
    w = sum(im.width for im in images) + gap * (len(images) + 1)
    h = max(im.height for im in images) + gap * 2
    sheet = Image.new("RGBA", (w, h), bg + (255,))
    x = gap
    for im in images:
        sheet.alpha_composite(im, (x, gap))
        x += im.width + gap
    return sheet.resize((w * scale, h * scale), Image.NEAREST)
