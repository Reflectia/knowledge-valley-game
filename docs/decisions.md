# Design decisions

Answers from the project owner that are not covered by the spec or the design system.
Date: 2026-11-04.

## Assets

1. **Heroine walk cycle.** `characters/heroine-variants-new.jpg` has only idle poses (front, back, side). Walk frames (4 per direction, left = mirrored right) are drawn by the developer from those poses.
2. **Heroine customization.** One base sprite, recolored by palette swap (hair, skin, clothes). The six variants on the sheet are references for the palettes, not separate sprites.
3. **Mentor portraits** (`portraits/Gemini_Generated_Image_*.jpg`) are cut **with their frames**, 64×64:
   - elf with flower crown → `forest`
   - dwarf with miner helmet → `forge`
   - old woman with glasses → `library`
   - fox in top hat → `market`
   - owl → `tower` (kept as drawn; the spec's "mechanical owl" name stays)
   - the sixth image (book in a laurel wreath) is a thematic heraldic emblem that completes the grid.
4. **Enemies** (`enemies/enemies_new.jpg`), left to right, top to bottom: beetle, deadline, ghost, magpie, moth, slime, sprout (fly agaric mushroom), wisp (water drop).
5. **Start menu.** Menu items follow the spec (new game, continue, import save, settings, language) and are built from UI components, not baked into the backdrop. The backdrop comes from `backdrops/start-menu-cursor-new.jpg`; the sword on its right is the mouse cursor.
6. **Homestead** should look roughly like `lighting/homestead-day-night-new.jpg` by day and by night.
7. **Missing assets** (homestead buildings, discipline buildings ×5 levels, crops, furniture, weapons, tools) are temporarily taken from free packs (CC0 / CC-BY). They live in a separate folder and are listed in `ASSETS-TODO.md` so they can be replaced later.
8. **Music and SFX:** free packs with a license first; recorded in `CREDITS.md`.
9. **Mentor dialogues and letters:** the developer writes drafts in the design-system tone for the owner to edit.

## Tooling

10. Vitest is added for unit tests of the game logic (not in the spec's stack, approved).

## Plan import

11. **Re-import replaces the plan of the semesters in the file.** A discipline of those semesters that the file no longer has (e.g. its `discipline_id` changed) is removed when it has no done labs or scores, so the journal does not show a stale twin; one with progress is kept and the preview warns. Approved by the owner after a duplicate «Наука» tab (2026-11-05).

## Homestead

12. **The trading stall stays (addition to the spec).** The spec only has «Крамниця» as the `market` discipline building (5 upgrade levels, grows with labs) and mentions «знижки в крамниці» and seeds/furniture/weapons earned by play, but no trading place or shop screen. Buying and selling happen at a stall on the homestead (`shop` object in `scripts/maps/build-maps.mjs`), available from day one; the «Крамниця» building has no trade. To keep them apart, the stall window and its texts say «Прилавок» / «біля прилавка». Approved by the owner (2026-11-05).

## Exam bosses (stage 11)

13. **Boss combat is the v0.1 light combat** with bigger numbers (`src/content/bosses.json`): the boss chases on contact, stays near its clearing and walks back when the heroine runs off. Chosen by the owner (2026-11-10).
14. **The boss waits at the end of the location's path, in the last fog zone.** That zone opens at revival stage 5, i.e. when every lab is done, which is also when the boss can appear.
15. **Knowledge shield = one blocked boss hit per on-time lab** (spec §4 «щит знань на старті»). Shown as pips over the boss's health bar.
16. **A defeat by the boss is the ordinary defeat** (home, part of the resources lost, the day ends), so «переграти наступного дня» needs no extra rule.
17. **The victory is saved at once with the labs** (`labs.exams`); the trophy goes into the bag and is paid once, also after a closed tab (`world.trophies`). Boss coins and XP follow the world, like enemy loot.
18. **Boss names, texts and trophies are drafts** (`bosses.json`, `items.json`) for the owner to edit; the art prompt is `docs/gemini-prompt-bosses.md`. Until the art exists the boss is its biome enemy drawn ×2 and the trophy a self-drawn cup.
