---
name: push
description: The maintainer's approval to push a feature branch, as a window of 30 minutes by default. Only the maintainer types it; the model cannot give itself the approval, and main stays locked either way.
disable-model-invocation: true
rules:
  - .claude/rules/workflow.md
data: []
gates:
  - scripts/ticket.ts
  - scripts/install-git-hooks.sh
---

# push — a window only the maintainer opens

At the end, pushing a `feat/*` branch from this session is allowed for the named time, then the window closes
again. `main` stays locked whatever the window says; the way to `main` is the pull request the maintainer merges.
Why the switch sits outside the model stands in [ADR 0004](../../../docs/ADR/0004-git-flow-and-history-guard.md).

## Steps

1. **The maintainer types the line** — `push`, optionally with a duration: `push 8h`, `push 90min`; without one,
   30 minutes, at most 24 hours. Only a line that starts with `push` counts; one that mentions pushing is talk.
   *Done when the line starts with `push`.*
2. **The hook writes the window** — the `UserPromptSubmit` hook
   [push-window](../../hooks/push-window.ts) sees the prompt before the model and records the window through
   [ticket.ts](../../../scripts/ticket.ts). *Done when it reports the window with its minutes.*
3. **The git hook asks at push time** — the pre-push lock from
   [install-git-hooks.sh](../../../scripts/install-git-hooks.sh) checks the window, but only for a push from a
   session; in the maintainer's own terminal it does not apply. *Done when the push passes or names its reason.*

## Acceptance

- [ ] The approval came from the maintainer's prompt, not from a shell command
- [ ] The window is recorded and has not expired at push time
- [ ] The push went to a `feat/*` branch, never to `main`
