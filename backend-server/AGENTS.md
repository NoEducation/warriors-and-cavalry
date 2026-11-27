# Agent Instructions — backend-server

The repository-wide rules (commits, authorship, pull requests, design documents) are in the root `AGENTS.md`; this file adds the rules for the server. Every path below is relative to `backend-server/`, and every `dotnet` command runs from this folder.

## Project

The multiplayer web server for the game in `../game-engine/`, written in .NET (C#, ASP.NET Core). It is not scaffolded yet: the folder holds only this structure. The first server work starts from a design document in `../docs/superpowers/specs/` that settles the .NET version, the project layout and the wire protocol.

Planned responsibilities: hosting the game site, accounts and lobby, creating matches, and relaying player commands between clients. The game simulation is deterministic (lockstep), so the server forwards and orders commands and checks world checksums; it does not run its own copy of the rules unless a spec says so.

## Layout

| Folder | Holds |
| --- | --- |
| `src/` | The server projects (`*.csproj`), one folder per project |
| `tests/` | The test projects, one per server project, named `<Project>.Tests` |

A solution file (`*.sln` or `*.slnx`) at the root of `backend-server/` lists every project.

## Gate

Once a project exists: `dotnet build` and `dotnet test` from `backend-server/`, both green on the committed HEAD. While iterating, run only the affected test project or filter (`dotnet test --filter <name>`).

## Code conventions

- Nullable reference types and implicit usings on; warnings treated as errors.
- One public type per file, the file named after the type. File-scoped namespaces matching the folder path.
- Every public member has an XML doc comment: what it does and when to call it.
- Data sent between server and clients is described by named records and documented in `../docs/` together with the client side; the game's command format stays plain serialisable data.
- Configuration lives in `appsettings.json` and strongly typed options classes, never in scattered constants. Secrets never go in the repository: use user secrets or environment variables.
- Tests exercise real behaviour (a real host via `WebApplicationFactory`, real serialisation) rather than mocks where that is practical.
- No new NuGet packages without asking the owner.
