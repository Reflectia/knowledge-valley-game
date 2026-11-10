# Asset scripts

Turn the owner's large AI-generated JPGs into native-size pixel sprites in `public/assets/`.
Requires Python 3.10+ with Pillow and numpy (`pip install pillow numpy`). Run from the repo root.

| Script | Does |
| --- | --- |
| `build_heroine.py` | Heroine sheet (4 walk frames × down/up/right) and palette-swap tables |
| `build_sprites.py [enemies items portraits start homestead]` | Everything else; no arguments = all |
| `build_tools.py` | Tool icons (hoe, watering can, axe, pickaxe; sword = sword cursor) and the in-game arrow cursor |
| `build_mentors.py [--review]` | Mentor world sprites 16×32 (`public/assets/mentors/`), hand-drawn after the portraits |
| `draw_bosses.py [--review DIR]` | Exam bosses 32×32 (`public/assets/bosses/`) and trophies 16×16 (`items/trophy-<pack>.png`), hand-drawn in simple shapes after the owner's sheets |
| `draw_uniques.py [--review DIR]` | Unique lab items 16×16 (`public/assets/uniques/`), hand-drawn after their names |
| `build_potions.py` | Potion icons 16×16 (`items/potion-<id>.png`): the owner's potion with the liquid recoloured |
| `build_biome_tiles.py` | Biome tilesets (`images/biomes/`): sampled surfaces, hand-drawn props |
| `preview.py` | `docs/assets-preview.png`: old design-system PNG next to the new cut |
| `pixelize.py` | Shared pipeline (background removal, k-means palette, block majority downscale, grid sampling) |

All location tiles the game uses live in `images/biomes/` (biome tilesets and the homestead tiles);
put new tiles there too.

How a sprite is made (`pixelize.py`):

1. Crop the card from the sheet; remove the background by flood fill from the crop border
   (soft gradient model for cards, "green" mode for objects standing on grass).
2. Reduce colors with k-means on the full-resolution figure.
3. Downscale: each output pixel takes the most common color of its block; `dark_weight`
   gives sub-pixel eyes and outlines a chance to survive.
4. Images drawn on a regular art grid (start backdrop) are sampled cell by cell instead.

Crop coordinates are source pixels and live next to each asset in the scripts.
When a new image replaces an old one, update the coordinates and re-run the script.
