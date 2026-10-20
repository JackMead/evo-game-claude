---
name: ship
description: Commit the current changes in Jack's local evo-game-claude folder and push them to GitHub. Use when Jack says "ship it", "/ship", "commit and push", or similar.
---

# Ship: commit and push evo-game-claude

Jack doesn't run git himself. This skill gets his local changes onto GitHub's `main`, working
around the fact that the device shell on his computer can't push (SSH remote, no network SSH,
no access to `~/.ssh`). The commit is made locally, then carried to the cloud workspace as a git
bundle and pushed from there. Commit hashes are identical on both sides.

Do every step **in order, never in parallel**. Stop and report if any step fails.

## 1. Check what's being shipped (device shell)
```bash
cd "$HOME/mnt/evo-game-claude" && git status --short && git log --oneline -3 && git status -sb | head -1
```
- Nothing to commit and not ahead of `origin/main` → tell Jack there's nothing to ship and stop.
- Look over the changed files. Don't commit secrets, `evo.bundle`, or stray scratch files;
  ask Jack if something looks unintended.
- If a playtest happened this session, make sure `docs/experiments.md` has the notes first.

## 2. Commit (device shell)
If `git` fails with "Operation not permitted" or leaves `.lock` files, request delete permission
on `C:\Code\evo-game-claude` (once per session) and retry.
```bash
cd "$HOME/mnt/evo-game-claude" && git add -A && \
git -c user.name="Jack Mead" -c user.email="jm3ady@gmail.com" commit -q -F - <<'MSG'
<Imperative summary of the change>

<Optional short body: what changed and why>

Co-Authored-By: Claude <noreply@anthropic.com>
MSG
git bundle create evo.bundle main && git log --oneline -1
```
Write the message from the actual diff. Use the attribution lines the session asks for, if any.

## 3. Carry the bundle to the cloud
Stage `C:\Code\evo-game-claude\evo.bundle` with the device staging tool. It lands at
`/mnt/user-data/uploads/evo-game-claude/evo.bundle`.

## 4. Push (cloud workspace)
If `/home/claude/evo-game-claude` isn't a working clone yet, attach `JackMead/evo-game-claude`
with push access through the GitHub connector and clone it there.
```bash
cd /home/claude/evo-game-claude && \
git fetch -q /mnt/user-data/uploads/evo-game-claude/evo.bundle main && \
git reset -q --hard FETCH_HEAD && git push origin main
```
- If the push is rejected as non-fast-forward, GitHub has commits that aren't local (Jack edited
  on GitHub). Don't force-push. Pull them into the local copy first (the reverse route:
  `git bundle create` in the cloud clone → write it into the folder → `git pull` from that file),
  then start again from step 1.
- If the connector has no access to the repo, ask Jack to add the repo to the Claude GitHub app
  (GitHub → Settings → Applications → Claude → Configure).

## 5. Tidy up and sync (device shell, only after the push succeeded)
```bash
cd "$HOME/mnt/evo-game-claude" && rm evo.bundle && \
git update-ref refs/remotes/origin/main main && git status -sb | head -1
```
Expect `## main...origin/main` with nothing ahead or behind.

## 6. Report
One or two lines: the commit hash and summary, and that GitHub is in sync. If GitHub Pages is
enabled, mention the site updates in a minute or two.
