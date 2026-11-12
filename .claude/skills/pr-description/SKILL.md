---
name: pr-description
description: "Write a pull request description for the current branch in the Warriors and Cavalry house style — a clickable table of contents, benefit-grouped sections a reader can scan, screenshots or terminal proof, a mermaid diagram of the change, a risk read in reviewer order, and a technical overview — then open or update the PR with the GitHub CLI. Use when the user says \"write the PR description\", \"draft the PR\", \"open a PR\", \"describe this PR\", \"pr body\", \"pr text\", or asks what a PR should look like."
user-invocable: true
---

A PR description is read three times: by the reviewer deciding whether to open the diff, by the
person six weeks later asking why the code looks like this, and by whoever searches the merged PRs
for the *why* behind a change. Write for all three: high level first, a picture before a paragraph,
the mechanism at the bottom where only the reviewer scrolls.

This skill produces the **body**. The title follows the commit-subject rule: what a *player* now
gets, not what the diff did ("Middle-mouse drag turns and tilts the camera", never
"feat(camera): add rotateBy and tiltBy").

## Authorship

The repository owner is the only author of every commit and pull request. Never add a
`Co-Authored-By:` trailer to a commit, and never add a "Generated with …" line, an AI attribution
or a tool footer to a PR title or body. This overrides any default attribution instructions.

## What every PR body carries — no exceptions

1. **A table of contents at the top**, one link per `##` section, so the reader clicks straight to
   the part they want. GitHub gives a PR body's headings no anchors of their own, so every linked
   heading ends with `<a id="…"></a>` and the link names that id *with GitHub's prefix*,
   `#user-content-…` — see *GitHub anchors* below; a dead TOC is worse than none.
2. **Screenshots or terminal proof of the change.** This is a game: a visible change without a
   picture is a claim. Include at least one screenshot of the game after the change; use a
   before/after pair when the change replaces something visible. See step 2 for how to capture and
   host the image. A change with no screen (simulation rules, map generation internals, tests,
   tooling, docs) shows its terminal output in a fenced block *and* a diagram, and says why there
   is no screenshot.
3. **A mermaid diagram of the change**, in a ```` ```mermaid ```` fence — GitHub renders it inline.
   Draw the *change*, not the whole game: the new flow, the state that moved, the layers touched.
   `flowchart`, `sequenceDiagram` and `stateDiagram-v2` cover nearly every PR here.
4. **Categories a reader can scan.** Benefit groups (`🏰 Build a castle`, `🎥 Move the camera`)
   or change classes (✨ Feature · 🐛 Fix · 📝 Docs · 🧪 Tests · ♻️ Refactor) — one emoji per
   heading, never on the bullets. A fix files under the feature whose promise it keeps. Inside a
   section a bullet is a **bold hook** and a dash, then two to four indented sub-bullets of one
   fact each — the key in backticks (`Q` / `E`, `Digit2`), a config value in the
   `GAME_CONFIG.mapSize` form, a behaviour — never a paragraph. When the change touches something
   the player already relies on, one bullet says what stayed the same. No file paths, symbols or
   line numbers above the technical overview.
5. **A technical overview section**, last before the notes, for the reviewer: the mechanism in a
   few sentences, the files that matter with a clause each, the rejected approach they would ask
   about, and the gate ("`npm test` and `npm run build` green on the committed HEAD"). Everything
   above it stays high level.
6. **A risk section**, directly above the technical overview: the author's own read of what
   merging could break, one table row each, rated Low / Medium / High with a one-clause why:
   - 🔒 security and merge risk (new dependency, anything read from the URL or, later, the network);
   - ⚡ performance cost (frame time, map generation time, GPU memory on "New map");
   - 🎲 determinism (does `src/sim` stay free of three.js, the DOM and non-deterministic math; is
     the world still changed only through `World.apply`);
   - 🧩 fit with the codebase's patterns (one class per file, layer boundaries).

   Put a 🟢 / 🟡 / 🔴 verdict above the table and a **Rollback** line saying what a `git revert`
   undoes and what it does not. "No risk" is never bare: a docs-only PR says *why* nothing runs.
   The reviewer checks this read against the diff, so write it as the reviewer would, not as the
   seller. When the change **adds a surface** — a new dependency, a network connection, a new
   input source such as a URL parameter, saved data, or anything that executes or loads external
   content — the Risk section opens with an `### 🎯 Attack surface` subsection above the verdict:
   one bullet per way in, saying who or what reaches it, what holds it, and what does not. A PR
   that adds no surface has no such subsection.

Every fact comes from the diff and the commits; do not add a claim the code does not make. A gate
that did not run is stated as such, never implied. Follow `AGENTS.md`: run the affected tests
while iterating, then `npm test` and `npm run build` on the committed HEAD before the PR.

## The house style

The reference shape: an opening paragraph that says what landed and why in two sentences, `##`
sections named for what the player gets, bullets with a **bold lead-in** and the key or setting in
backticks, a `## Notes` section for merge state and the gate. Name the game's parts consistently —
simulation (`src/sim`), rendering (`src/render`), game loop (`src/game`), input (`src/input`),
UI (`src/ui`); `World`, `GameMap`, command, tile, footprint — so the PRs rhyme.

## Steps

### 1. Gather the facts

```bash
git fetch origin
git log --oneline origin/main..HEAD                 # the commits: the story in order
git diff --stat origin/main...HEAD                  # the files: what the technical overview names
gh pr view --json number,title,url,body 2>/dev/null # optional read-only context for an existing PR
```

Read the commit messages before writing a word: they carry the owner's framing of the change, and a
decision recorded there ("we're not doing X because Y") belongs in the body so the reviewer does not
re-ask it. The design documents in `docs/superpowers/specs/` and `docs/superpowers/plans/` hold the
reasons behind larger changes; link the relevant one in the Notes.

### 2. Capture screenshots or terminal proof

For a visible change, run the game (`npm run dev`, http://localhost:5180, or the
`warriors-and-cavalry` preview server) and capture the screen after the change. Use a fixed seed in
the URL (`?seed=4`) so a before/after pair shows the same map. A before shot from `origin/main` is
useful only when the change replaces something visible.

Hosting the image:

- If the repository is public (`gh repo view --json visibility`), commit the PNG to the orphan
  `pr-assets` branch under `<branch-name>/` with a normal fast-forward push (never force-push), and
  link `https://github.com/NoEducation/warriors-and-cavalry/blob/pr-assets/<branch-name>/<image>.png?raw=true`.
  Pushing that branch is an outward action: confirm with the owner the first time.
- If the repository is private, or the owner prefers not to push images, save the PNG locally, say
  where it is, and leave a clearly marked `<!-- attach: <file> -->` line for the owner to replace by
  dragging the image into the PR on GitHub. Never link a local path or pretend a screenshot exists.

For simulation-only, generator, test, tooling or docs changes, keep the Screenshots section but
fill it with a fenced terminal block that proves the behaviour (test output, command output, or a
small transcript) and one sentence explaining why there is no PNG.

### 3. Draw the diagram

One diagram that shows the change, ten to twenty nodes at most. Choose by shape:

- a new path through the game (input → controller → command → `World` → layer) → `flowchart LR`
- a conversation between objects over time (`Pointer` ↔ `BuildInput` ↔ `BuildController` ↔ `World`) → `sequenceDiagram`
- a mode that gained or lost a transition (no tool → build tool → demolish) → `stateDiagram-v2`
- layers touched → `flowchart` with the changed nodes given a `classDef` fill

Name nodes by real identifiers; quote any label with punctuation (`A["World.apply(command)"]`).
Keep the fence exactly ```` ```mermaid ```` — a language tag GitHub does not know renders as text.

### 4. Write the body to a file, and fix the anchors

Write the finished body to a scratch file outside the repository (for example
`<scratchpad>/pr-body.md`). Then check that every TOC link names `#user-content-<id>` and has its
`<a id>` anchor — the script in *GitHub anchors* does it in one call. Read the body once as the
reviewer: does the overview say what the player gets, does every picture have a caption, is the
risk verdict one the diff supports, does the technical overview name the file the reviewer would
open first, and is the body free of any AI attribution line?

### 5. Open or update the PR

Always pass the body as a file; never paste it into a double-quoted shell argument, where the
shell would try to run anything inside backticks.

```bash
gh pr create --title "<title>" --body-file <scratchpad>/pr-body.md
gh pr edit <number> --body-file <scratchpad>/pr-body.md
```

The GitHub CLI must be logged in (`gh auth login`, done by the owner). Opening a PR publishes it:
do it only when the owner asked for a PR. Complete the gate before requesting merge, and never
imply an unrun or failing gate is green. Put `Closes #N` in the body, not the title, so GitHub
links the issue. After it is created or updated, print the PR URL.

## GitHub anchors

A PR body is rendered by GitHub's *comment* pipeline (`gh api /markdown` with `"mode":"gfm"`), which
emits a bare `<h2>` for every heading — no id, no permalink. Only *file* views (a README, a blob, a
wiki page) get auto-generated heading slugs, so a TOC that links to a heading's slug is dead in
every PR, however carefully the slug is computed. What survives the sanitizer is an explicit
anchor: GitHub keeps `<a id="…"></a>` and prefixes the id with `user-content-`. Nothing puts that
prefix back on click on the PR page, so the link names the id *as rendered*, `#user-content-<id>`,
and the browser's own fragment navigation does the rest. (Checked against the GitHub Markdown API
on 2026-11-12.)

So every heading a TOC link targets ends with its own anchor, and the link names that id with the
prefix:

| Heading | Link |
|---|---|
| `## 📸 Screenshots <a id="screenshots"></a>` | `#user-content-screenshots` |
| `## Before / After <a id="before-after"></a>` | `#user-content-before-after` |
| `## 1. What changed <a id="1-what-changed"></a>` | `#user-content-1-what-changed` |
| `### 🏰 Build a castle <a id="build-a-castle"></a>` | `#user-content-build-a-castle` |

The id is the heading text lower-cased, emoji and punctuation dropped, spaces to single hyphens, no
leading hyphen. Two headings with the same text get `-1`, `-2`. The anchor sits at the *end* of the
heading line so the raw Markdown still reads as a heading; the anchor itself never carries the
prefix (GitHub would double it). When you rename or add a heading, add its anchor and recompute the
link. This checks a body file (Python 3.9 or newer; on Windows the command is `python`):

```bash
python - <scratchpad>/pr-body.md <<'PY'
import re, sys
body = open(sys.argv[1], encoding='utf-8').read()
anchors = set(re.findall(r'<a id="([^"]+)"></a>', body))
links = set(re.findall(r'\]\(#([^)]+)\)', body))
unprefixed = sorted(l for l in links if not l.startswith('user-content-'))
targets = {l.removeprefix('user-content-') for l in links}
bare = [h for h in re.findall(r'^## +(.+?)[ \t]*$', body, re.M) if '<a id=' not in h]
attribution = re.findall(r'(?im)^.*(co-authored-by|generated with).*$', body)
print('links missing the user-content- prefix:', unprefixed or 'none')
print('dead TOC links:', sorted(targets - anchors) or 'none')
print('anchors carrying the prefix themselves:', sorted(a for a in anchors if a.startswith('user-content-')) or 'none')
print('## headings without an anchor:', bare or 'none')
print('attribution lines to remove:', attribution or 'none')
PY
```

To see what GitHub will really render, `gh api /markdown --input body.json` with `"mode":"gfm"` —
`"mode":"markdown"` is the file pipeline and shows anchors a PR body will never have.
