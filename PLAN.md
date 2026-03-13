# PiWork Plan

## Product boundary

PiWork v1 is intentionally small:

- chats
- indexed read-only folders
- generated artifacts under `~/piwork`

Deferred:

- pinned items
- daily notes
- task boards / kanban
- alternate runtimes

## Current implementation priorities

1. Make first-run setup obvious for non-developers.
2. Surface model availability and actionable remediation.
3. Make runs controllable with cancel and retry.
4. Ship signed, updateable Electrobun builds.

## Launch gates

- `bun run build` passes
- canary/stable packaging works in CI
- no stale pre-launch product copy remains in shipped docs/UI
- updater metadata and installer artifacts are published together
