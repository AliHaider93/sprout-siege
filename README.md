# Sprout Siege

A tiny lawn-defence game for the browser. Plant shooting plants on a 5-by-8 garden, collect sun, and stop the zombies shambling down the columns before they reach your house.

**Play it:** https://alihaider93.github.io/sprout-siege/

No install, no build step, no dependencies. One HTML page plus one JavaScript file on an HTML5 canvas. All art is drawn in code.

## How to play

- Tap a **seed card** at the bottom, then tap a **lawn tile** to plant. Plants cost sun.
- Tap the **suns** that fall from the sky or sprout from Sunblooms.
- Zombies walk **down the columns** and eat whatever is in front of them. Shooters only hit their own column.
- Each column has one **garden gnome** that clears it once if a zombie gets through. The next one that gets through ends the level.
- Survive every wave to win. Keys `1` to `9` and `0` pick seeds, `X` the shovel. The menu has an auto-collect toggle for suns.

## Plants

| Plant | Sun | Unlocks | What it does |
|---|---|---|---|
| Sunbloom | 50 | level 1 | Makes 25 sun every 8 s |
| Seedshooter | 100 | level 1 | Shoots a seed every 1.4 s |
| Nutwall | 50 | level 2 | Tough wall |
| Blastberry | 150 | level 3 | Explodes, clears a 3×3 area |
| Thornpatch | 100 | level 4 | Ground spikes, cannot be eaten |
| Icebloom | 175 | level 5 | Frozen seeds slow zombies |
| Twinshooter | 200 | level 6 | Two seeds per shot |
| Twinbloom | 125 | level 7 | Makes 50 sun every 8 s |
| Lobber | 175 | level 8 | Lobs splash-damage melons over the front line |
| Gatling | 250 | level 9 | Four seeds per burst |

## Zombies

Shambler, Conehead (level 2), Sprinter (level 3), Buckethead (level 4), and the plant-smashing Hulk (level 6). Levels are generated from a seed, so each level plays the same way every time.

## Running locally

```
python3 -m http.server 8000
```

then open http://localhost:8000/.

## Regenerating the share image

```
python3 tools/make_og.py
```

needs Pillow and writes `og.png` and `icon-180.png`.

## Licence

MIT
