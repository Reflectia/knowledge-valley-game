# Asset status

What the game uses now, where it comes from, and what still needs a proper replacement.
Visual check: `docs/assets-preview.png` (old design-system PNG next to the new cut, ×4).

## From the owner's new images (cut by `scripts/assets/`)

| In game | File | Source | Notes |
| --- | --- | --- | --- |
| Heroine, 4 walk frames × down/up/right | `public/assets/characters/heroine.png` | `characters/heroine-variants-new.jpg` (red hair, green shirt) | Walk frames drawn from the idle poses. Left = mirrored right. |
| Heroine palettes (4 hair, 4 skin, 4 shirt) | `public/assets/characters/heroine-palettes.json` | colors matched to the variants on the same sheet | Recolored at runtime. |
| Enemies ×8 | `public/assets/enemies/*.png` | `enemies/enemies_new.jpg` | |
| Items ×4 | `public/assets/items/*.png` | `items/items-new.jpg` | **staff** is thin at 14 px — worth redrawing. |
| Mentor portraits ×5 + emblem | `public/assets/portraits/*.png` | `portraits/Gemini_Generated_Image_*.jpg` | Cut with frames; frames are 58–60 px wide inside the 64×64 canvas. |
| Start menu backdrop 475×265 | `public/assets/ui/start-bg.png` | `backdrops/start-menu-new.jpg` | One pixel per art cell (grid 5.78 px), 64 colours. `scripts/assets/build_start_menu.py`. |
| Start menu title 213×75 | `public/assets/ui/start-title.png` | `backdrops/start-menu-interface-new.jpg` | Keyed out of the sky (the assets sheet draws it on a plaque, the reference does not). |
| Start menu panel 117×55 (9-slice) | `public/assets/ui/start-panel.png` | `backdrops/start-menu-assets-new.jpg` («Нова гра» button) | Centre filled with plain parchment; edges repeat when the panel is taller. |
| Mouse cursor (sword) | `public/assets/ui/cursor-sword-16.png`, `-32.png` | same file, right panel | Thin at 16 px; the gold guard is barely visible. |
| Homestead house, 2 blossom trees, lamp post | `public/assets/homestead/*.png` | `lighting/homestead-day-night-new.jpg` (day half) | Cut at 1/8 so the door matches the heroine's height. |
| Lit window (night overlay) | `public/assets/homestead/window-lit.png` | same file, night half | The rest of the night look comes from lighting. |
| Homestead tiles: grass, grass with flowers, path | `images/biomes/homestead-tiles-16.png` | same file (colors only) | Hand-drawn in the scene's colors (`HOMESTEAD_TILES` in `build_sprites.py`); seamless, nothing touches the tile border. |
| Biome tilesets ×5 (ground, path, special surface, prop, prop on transparency) | `images/biomes/<biome>-tileset-16.png` | `previews/Biomes/<biome>-palette-tiles-stages-new.jpg` (row of sample tiles) | `scripts/assets/build_biome_tiles.py`. Surfaces sampled on the 16×16 art grid; props (anvil, books, apple crate, crystals) redrawn by hand at 16×16 because the sheets draw them at ~32×32; the forest tree is sampled. Surfaces are made seamless: the light gradient is removed and the seams are regrown from the tile's own texture; brick paths (forge, library, market, tower) are rebuilt as a regular running bond in the sample's colors. Revival stages on the sheets are unused (filter in the game). The owner approved using these sheets although they sit in `previews/`; the old design-system tilesets and biome previews were deleted. |

All location tiles the game uses are in `images/biomes/`; new tiles go there too.

## Temporary third-party placeholders — to replace

All in `public/assets/_temp/`, each folder with its license. Frame numbers are also in `src/game/assets/manifest.ts` (`TEMP_FRAMES`).

| Needed for | Placeholder | Frames |
| --- | --- | --- |
| Crops with 5 growth stages (20 crops) | `_temp/josehzz-farming-crops/crops.png` | 6 per crop: 0 = harvest item, 5→1 = seed → mature |
| Tilled soil / garden beds | `_temp/kenney-tiny-farm/tilemap.png` | 0, 1, 12, 13, 24, 25, 36, 37, 48–51, 60–63 |
| Tools: watering can, sickle, axe | `_temp/kenney-tiny-farm/tilemap.png` | 84, 88, 87 |
| Tools: pickaxe; bow | `_temp/kenney-tiny-town/tilemap.png` | 115; 118 |
| Fences | `_temp/kenney-tiny-town/tilemap.png` | 44–47, 56–59, 68–71, 80–82 |
| Discipline buildings ×5 (5 upgrade levels each) | `_temp/kenney-tiny-town/tilemap.png` | walls, roofs, doors 48–91 — assembled in the maps (stage 5–6) |
| Sword, staffs | `_temp/kenney-tiny-dungeon/tilemap.png` | 103–107, 129–131 |

House interior: the owner's art (`images/interior/interior-surfaces-new.jpg`,
`interior-objects-new.jpg` → `public/assets/interior/`, `scripts/assets/build_interior.py`): a 4×4-tile
floor patch, a 2-tile log wall with a window and a herb shelf, and 12 furniture sprites (bed, desk with
the journal, bookshelf, chest, fireplace, rug, door mat, fern, palm, lamp, table with stools, clock).
Furniture comes from the simpler sheet `interior-objects-simple-new.jpg` (sampled one drawn
pixel = one game pixel); the chest and the herb shelf above the bed are self-drawn in the same style
(`CHEST`, `SHELF` in `scripts/assets/build_interior.py`).
The furniture items in the shop use the same sprites. The old self-drawn interior tiles 0–11 in
`_temp/interior/interior-16.png` are no longer used.

Also self-drawn there: garden soil (dry / watered). The old self-drawn shop stall (`_temp/interior/shop-stall.png`)
is no longer used: the trading stall is cut from `images/buildings/shop-stall-new.jpg` into
`homestead/shop-stall.png` (56×57) by `python scripts/assets/build_buildings.py stall`.

Discipline buildings (5 levels) are assembled from Kenney Tiny Town roof and wall tiles
(`src/game/world/buildings.ts`): red or grey roofs per pack, wider and taller with each level.
Need real art: 5 buildings × 5 levels (Оранжерея моделей, Вежа голема-помічника, Крамниця,
Майстерня, Алхімічна лабораторія).

Item icons in `src/content/items.json` come from the temporary packs: tools (Tiny Farm / Town /
Dungeon), crops and growth stages (josehzz), furniture (the owner's interior sprites), wood and
stone (Tiny Farm), location resources (the biome's prop tile). Seeds use the owner's seed bag
(`items/seed.png`) with the crop in the corner.

Maps (`public/assets/maps/*.json`, Tiled 1.10) are generated by `scripts/maps/build-maps.mjs` as a first
layout: homestead 40×30, house 12×9, five locations 36×24. They can be opened and redrawn in Tiled;
keep the object types listed at the top of the script.

Mentors in the world (in their location and visiting the homestead) are 16×32 figures drawn by
hand after the portraits (`public/assets/mentors/<pack>.png`, `scripts/assets/build_mentors.py`):
elf druid, mechanical owl, fox merchant, dwarf smith, old astronomer. Front view only, no walk frames. The mailbox (flag down / up) is
self-drawn (`mailbox.png`).

Unique items (5 per pack) have no art of their own yet: the game shows one item sprite per pack
(`uniqueIcon` in `src/content/packs/*.json`: forest → seed, tower → staff, market → potion,
forge → staff, library → book) inside the rarity frame. 25 item sprites 16×16 are needed.

Combat: enemies use the owner's sprites (`enemies/*.png`). The bow icon is Tiny Town (temporary);
the staff is the owner's staff sprite. The spark and arrow projectiles are drawn in code from
design tokens (rune-glow, river-300, wood-700). The sword swing reuses the sword icon.

Audio (stage 9) is from free CC0 packs, all listed in `CREDITS.md` and built by
`scripts/assets/build_audio.py`. To replace: keep the file names in `public/assets/audio/music/<place>.ogg`
and `sfx/<name>.ogg`. The night music is the day track through a low-pass filter and reverb (made
at runtime); real night arrangements can replace it later (would need a `music/<place>-night.ogg`
and a small change in `src/audio/engine.ts`). Footsteps are one surface (no grass/stone variants).

Discipline buildings: all five packs use the owner's art
(`images/buildings/building-<pack>-new.jpg` → `public/assets/buildings/<pack>-1..5.png`,
`scripts/assets/build_buildings.py`; level 5 fits 88×144 px, one scale per building).
Sheet choices: forest has 6 drawings — level 4 is the lower-middle one (the lower-left wide
glasshouse is unused); library has two variants of levels 1–2 — the lower ones are used.
The Tiny Town building tiles (`src/game/world/buildings.ts`) remain only as a fallback for
future packs without art.

Still missing, no placeholder yet: exam bosses 32×32 (v0.2), house interior tiles.
