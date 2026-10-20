# Experiments log

Format: hypothesis → what we built → how it felt → keep / tweak / kill.

## 001: Evo Blob
**Hypothesis:** "Eat to grow, and every few meals pick 1 of 3 mutations" (agar.io + roguelite
upgrades) creates interesting build choices, especially when rivals also evolve over time.

**Built:** Single cell in a petri dish. Mouse/WASD to move. Eat food and smaller cells; avoid bigger
ones (red ring = can eat you, green = you can eat it). Evolution choices: Flagella, Cilia,
Spikes, Membrane, Camouflage, Metabolism, Eyespot. Rivals gain a random mutation every 25s.

**Playtest notes:** _(pending)_

## 002: Breeder
**Hypothesis:** Choosing which creatures to breed, using traits you can *see*, is fun when the
world has hidden rules that punish the obvious strategy. Example: you breed your two biggest
creatures, and then it turns out big creatures are prone to madness. Working out the hidden rules
from what happens is the hook.

**Built:** A herd of 8 in a pen, survive 12 seasons. Before each season you see the forecast (mild,
harsh winter, heatwave, predators, famine) and click pairs of adults to breed. The season plays
out over ~7s and the chronicle logs deaths, madness and births, with each creature's visible traits
alongside, so patterns can be spotted. Pairs whose parents both survive have up to 2 young at the
end of the season.
- Visible traits, shown by how creatures look: size (body), speed (number/length of legs), fur
  (tufts), colour (no effect, but helps track lineages). Tooltip uses words; `?stats` shows numbers.
- Hidden genes: temper, vigour, plus a recessive *blight* gene (two carriers can have sickly young).
- Each world secretly picks 2 of 3 "curses": giant madness (big creatures attack the nearest herd
  member), racing hearts (fast creatures collapse), fluffy sterility (fluffy creatures fail to breed).
- All rules are revealed at game over. `?seed=N` / "Replay this world" replays the same world.

**Playtest notes:** _(pending)_
