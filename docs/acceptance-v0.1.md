# v0.1 MVP — acceptance check

Spec §10 «Критерії приймання MVP», checked on 2026-11-05 (stage 9).
Automated: `npm test` (Vitest, 136 tests). Manual: headless Chrome playthroughs
(`scripts/dev/drive.mjs` style), screen 1536×864 at DPR 1.25.

| # | Criterion | Status | How it is checked |
| --- | --- | --- | --- |
| 1 | Runs locally with one command and builds to static files | ✅ | `npm run dev`; `npm run build` → `dist/` (relative paths, `base: './'`); `npm run preview` loads the start menu with no errors or missing files |
| 2 | CSV/XLSX import of 24 labs creates 5 locations, mentors and buildings; errors are shown before applying | ✅ | `importPlan.test.ts`: «acceptance: a 24-lab semester plan», «errors are shown before applying», «XLSX with real date cells», Excel encodings; playthrough: 24 labs → 5 packs, 6 letters |
| 3 | «Виконано» gives a branch point, a location stage, a building upgrade and raises the ceiling | ✅ | `rewards.test.ts` ««Виконано» (acceptance: skill point, stage, building, ceiling)» |
| 4 | An entered score gives an item of the right rarity by the threshold table | ✅ | `rewards.test.ts` ««Ввести бал» (acceptance: rarity by threshold)»; `rules.test.ts` «rarity by score» |
| 5 | Retroactive labs count on-time by the done date; re-import or edits never duplicate rewards | ✅ | `rewards.test.ts` «no duplicated rewards», «retroactive labs»; `importPlan.test.ts` «importing the same file again changes nothing and pays nothing» |
| 6 | XP stops at the ceiling and grows again after a lab is done | ✅ | `rules.test.ts` «stops XP at the ceiling and resumes when the ceiling rises» |
| 7 | A mentor writes 3 days before a deadline and visits on the deadline day | ✅ | `mentors.test.ts` «letters and visits (spec §6)» |
| 8 | A full game day lasts 12–15 min; energy and crop growth work by game days | ✅ | `time.test.ts` «lasts 12–15 real minutes» (06:00→02:00 in 810 s = 13.5 min); `homestead.test.ts` garden cycle; `save.test.ts` «day, energy and sleep» |
| 9 | Defeat in combat brings the heroine home and costs part of the resources | ✅ | `combat.test.ts` «defeat»; `save.test.ts` «at zero health: defeat, losses, the day ends»; playthrough (stage 8) |
| 10 | Closing the tab mid-day loses no lab data; `.json` export and import restore the game fully | ✅ | `save.test.ts` «closing the tab mid-day keeps lab data and pays its rewards exactly once», «export then import restores the game completely» |

## Sound (spec §8), stage 9

- Music: a track per place (homestead, 5 locations), day and night versions, crossfade between
  places and a smooth day→night blend. Menus play the homestead theme.
- Effects: steps, till, plant, watering, harvest, chop, mine, sword/bow/staff, spell, enemy hit and
  defeat, heroine hurt, coins, door, journal, a new letter, a reward jingle per rarity.
- Master / music / effects sliders change the volume at once; a sample plays when the effects slider
  is let go. A hidden tab is silent.
- Playthrough: steps, door, till, plant, water, mail and `reward-legendary` played; music
  `homestead` → `forest` on the map change; at 23:00 the night version is on (dry 0.05, wet 0.81).

## Known limits of v0.1 (by design or for later versions)

- English is v0.3; the ENG toggle is disabled.
- Exam bosses, mentor story arcs, alchemy and GitHub Pages deploy are v0.2.
- Temporary art and audio are listed in `ASSETS-TODO.md` and `CREDITS.md`.
- Night music is the day track filtered at runtime, not a separate arrangement.
