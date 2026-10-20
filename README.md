# evo-game-claude

## Why this repo exists
**Main goal: an experiment in completely hands-free development.** I (Jack) direct the work in plain
language, and Claude writes the code, tests it, commits and pushes. I try to almost never write code
or run terminal commands myself. Along the way I'm learning how to get the most out of working with
AI this way, and the context that makes it work lives in the repo, so it can be shared and reused:

- [`CLAUDE.md`](CLAUDE.md): project goals, conventions and workflow that Claude follows
- [`.claude/skills/`](.claude/skills/): repeatable procedures (e.g. `ship` to commit and push)

**Side quest: a small evolution-themed game.** A cheap sandbox for trying out gameplay ideas and
finding loops that are actually fun. Speed of experimenting matters more than polish. Each idea is
a separate, throwaway prototype in `experiments/`, and what we learn goes in
[`docs/experiments.md`](docs/experiments.md).

## Play
Open `index.html` in a browser. There's no build step and no dependencies.

## Deploy
GitHub repo → Settings → Pages → "Deploy from a branch" → `main` / root.
The site will be at `https://jackmead.github.io/evo-game-claude/`. Pages on a private repo needs
a paid GitHub plan.
