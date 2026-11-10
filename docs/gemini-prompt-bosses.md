# Gemini prompt: exam bosses and trophies (stage 11)

Two images, one prompt each. Paste the prompt as is; the text in quotes is what the image must not contain.
Save the results as `images/enemies/bosses-new.jpg` and `images/items/trophies-new.jpg`;
`scripts/assets/` will cut them to 32×32 (bosses) and 16×16 (trophies).

The names and looks are drafts (spec §3: «бос-екзамен і трофей» per pack, the spec gives no names).

| Pack | Boss (draft) | Idea | Trophy (draft) |
| --- | --- | --- | --- |
| forest | Перенавчений Пень | an old stump that memorised every leaf and recognises nothing new (overfitting) | Золотий жолудь |
| tower | Галюцинуючий Голем | an ice-crystal golem whose eyes glitch and show things that are not there | Кришталева сніжинка |
| market | Беклог-Мімік | a treasure-chest mimic stuffed with sticky notes and task scrolls | Золоті терези |
| forge | Моноліт-Спагеті | an iron block golem tangled in pipes and cables (spaghetti code) | Золоте ковадло |
| library | Рецензент Номер Два | a huge grumpy tome with spectacles and a red quill | Зоряне перо |

## 1. Bosses (5 sprites)

```text
Pixel art sprite sheet for a cozy fantasy farming RPG in the style of Stardew Valley.
Five cute exam boss monsters in one horizontal row, evenly spaced, each centred in its own square cell
of equal size, on a perfectly flat solid magenta background (#FF00FF) with no gradient, no floor, no shadow.
Each boss is designed on a 32x32 pixel grid with big chunky clearly visible square pixels, limited palette
(about 12 colours per boss), a 1-pixel dark coloured outline (dark brown or dark plum, never pure black),
top-down three-quarter front view facing the viewer, the whole body visible and touching the bottom of its cell.
Mood: friendly and funny, not scary: big expressive eyes, rounded chunky silhouettes, a slightly grumpy
"final exam" attitude. Each boss is clearly bigger and more detailed than a normal 16x16 enemy.

1. "Overfitted Stump" (spring forest, fresh greens and warm browns): an ancient tree stump with a tiny
   crown of leaves and pink blossoms, roots like little legs, glasses perched on its nose, a long paper scroll
   of notes wrapped around it.
2. "Hallucinating Golem" (winter crystal tower, icy blues, white and violet): a round golem made of ice
   crystals and runes, one eye glowing teal and the other eye glitching into pixel noise, small floating
   crystal shards around its head.
3. "Backlog Mimic" (summer fair, warm red, gold and cream): a wooden treasure chest with a toothy friendly
   grin, its lid bursting with colourful sticky notes, task cards and rolled scrolls, two little stubby feet.
4. "Spaghetti Monolith" (late autumn mountain forge, iron grey, rust orange, ember glow): a squat iron block
   golem tangled in pipes, cables and copper wires like spaghetti, glowing ember eyes, a tiny chimney puffing smoke.
5. "Reviewer Number Two" (autumn observatory library, deep blue, parchment, gold stars): a huge floating
   leather-bound book with an open grumpy face on its pages, round spectacles, a red quill pen held like a sword,
   little stars sparkling around it.

No text, no letters, no numbers, no labels, no UI, no border around the cells, no background scenery,
no anti-aliasing, no blur, no soft shading, no drop shadow.
```

## 2. Trophies (5 icons)

```text
Pixel art item icons for a cozy fantasy farming RPG in the style of Stardew Valley.
Five small golden trophies in one horizontal row, evenly spaced, each centred in its own square cell of
equal size, on a perfectly flat solid magenta background (#FF00FF) with no gradient and no shadow.
Each trophy is designed on a 16x16 pixel grid with big chunky clearly visible square pixels, about 8 colours,
a 1-pixel dark brown outline (never pure black), front view, standing on a small dark wooden base,
shiny warm gold (#e0ae5b highlights, deeper honey gold shading) with one coloured gem or detail each:

1. A golden acorn with two green leaves (spring forest).
2. A crystal snowflake in a golden ring, icy blue gem in the centre (winter tower).
3. Small golden balance scales with a red ribbon (summer fair).
4. A tiny golden anvil with an orange ember glow on top (mountain forge).
5. A golden quill pen crossing a small dark-blue star globe (observatory library).

No text, no letters, no numbers, no labels, no UI, no border around the cells, no background scenery,
no anti-aliasing, no blur, no soft shading, no drop shadow.
```
