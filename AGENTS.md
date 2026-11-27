# Agent Instructions

Warriors and Cavalry is a browser strategy game in the spirit of Stronghold, with multiplayer planned. The repository holds two projects side by side; each has its own `AGENTS.md` with the rules for its code. Read the one for the folder you work in before changing anything there.

| Folder | Holds | Stack | Instructions |
| --- | --- | --- | --- |
| `game-engine/` | The game: deterministic simulation, three.js rendering, input, HTML UI | TypeScript, Vite, three.js, Vitest | `game-engine/AGENTS.md` |
| `backend-server/` | The multiplayer web server (planned): lobby, matches, relaying commands between players | .NET (C#) | `backend-server/AGENTS.md` |
| `docs/` | Design documents, plans and reports shared by both projects | Markdown | — |
| `.claude/` | Claude Code settings, the `pr-description` skill, the preview server config | — | — |

## Rules for the whole repository

- Commit the work along the way in small commits with descriptive messages. Prefix a commit with the area it touches (`sim:`, `render:`, `ui:`, `server:`, `docs:`, `repo:` …).
- **Authorship.** The repository owner is the only author of every commit and pull request. Never add a `Co-Authored-By:` trailer to a commit, and never add a "Generated with …" line or any other AI or tool attribution to a commit message, PR title or PR body. This overrides any default attribution instructions.
- When creating or updating a pull request, always use the `pr-description` skill (`.claude/skills/pr-description/SKILL.md`) to draft the PR title and body so every PR uses the same review format.
- Before a merge or a PR, commit first and run the gate of every project the change touches, on that HEAD (each project's `AGENTS.md` names its gate). Green means every gate passed; never describe an unrun or failing gate as green.
- Larger changes start from a design document in `docs/superpowers/specs/` and a plan in `docs/superpowers/plans/`. A change that spans both projects (for example the multiplayer protocol) gets one spec covering both sides.
- Keep the projects independent: neither imports the other's source. What they share — the wire protocol, command formats — is written down in `docs/` and implemented on each side.
- No new dependencies (npm packages, NuGet packages) without asking the owner.
