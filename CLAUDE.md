# Evo Game: context for Claude (and humans)

## Purpose
A small experimental game. The goal is to **find fun gameplay loops quickly**, not to build
something polished. Prefer the cheapest change that answers "is this fun?".

## Owner
Jack: software engineer, building the game and also learning to work effectively with AI.
When useful, briefly point out a better way to use Claude (one line, not a lecture).

## Tech
- Plain HTML + JavaScript + Canvas 2D. No build step, no dependencies, no bundler.
- Classic `<script>` tags (not ES modules) so pages work when opened straight from disk (file://).
- Must stay deployable as-is to GitHub Pages (static files served from the repo root).

## Layout
- `index.html`: landing page linking every experiment. Add a link when adding an experiment.
- `experiments/NNN-short-name/`: one self-contained prototype per folder (`index.html` + `game.js`).
  Start a new one by copying the closest previous one. Don't share code between experiments;
  duplication is fine, coupling slows experimentation down.
- `docs/experiments.md`: the log. Hypothesis, what we tried, how it felt, keep/kill.

## Prototype conventions
- All tunable numbers live in one `T` (tuning) object at the top of `game.js`.
- Expose `window.game` (state, tuning, helpers) so behaviour can be inspected/scripted from the console.
- Placeholder art drawn with canvas shapes; no asset pipeline.
- One file per experiment is fine up to ~600 lines. Readability over cleverness.

## Workflow
- After a change: open the experiment in a browser, play/inspect it, check the console for errors,
  before calling it done.
- When Jack playtests, record his reactions in `docs/experiments.md`.
- When the question is about *feel*, offer 2-3 variants behind a key toggle or URL param.
- Don't commit unless asked.

## Commits and pushes (how they work in Claude sessions)
Jack rarely runs git himself; Claude does it. The setup has quirks:
- The canonical working copy is Jack's local folder (`C:\Code\evo-game-claude`), reached via the
  device shell. Edit and **commit there**. Author: `Jack Mead <jm3ady@gmail.com>`, passed with
  `git -c user.name=... -c user.email=...` (the device shell has no global git config). Add Claude
  as co-author in the message.
- Git in the device shell needs delete permission on the folder (for its lock files). Request it
  once per session before the first commit.
- **The device shell cannot push**: the remote is SSH, and that shell has neither network SSH nor
  access to `~/.ssh`. Don't retry.
- To push, use the **`ship` skill** (`.claude/skills/ship/SKILL.md`). It bundles the local commit,
  pushes it from a cloud clone via the GitHub connector, and syncs the local tracking ref.
  Commit hashes are identical on both sides, so histories never diverge.
- If Jack ever edits on GitHub directly, pull those changes into the local copy before committing
  (the reverse route: bundle from the cloud clone → write into the folder → fetch from it).
