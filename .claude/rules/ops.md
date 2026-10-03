---
paths:
  - "scripts/**"
  - ".githooks/**"
  - ".claude/**"
  - ".github/**"
  - "/package.json"
  - "/pnpm-workspace.yaml"
  - "/tsconfig*.json"
  - "/*.config.*"
  - "/.*rc*"
  - "/.*ignore"
  - "/.editorconfig"
adr: docs/ADR/0008-testing-and-gates.md
summary: >
  Tooling and gates. Every gate proves it can fail; a gate with false alarms is switched off; a violation that a gate
  missed is a hole in the gate. One carrier per rule, new rules only with the maintainer's yes. Generated files are
  never edited by hand. No images in the repo. The code never binds to our own infrastructure.
---

# Operations and tooling

## A loop reads with `while read -r`; a flag never sits in a variable
zsh does not split like bash; an empty variable in a recursive delete is a total loss. `[Hook guard-shell]`

## Gate and commit are joined with `&&`
Two commands on two lines run independently.

## The code never binds to our own infrastructure
Self-hosted and hosted instances are equal; we may offer hosting, never require it.

## Images and videos never enter the repo
A deleted image stays in the history forever.

## A generated file is never edited by hand
The generator is the source, the diff gate the proof. `[Hook pre-commit]`

## Three stages, and red is red
Hooks on every write, pre-commit on the staged state, the full verify before every push. No warning level.
`[Hook quality-guard · Hook pre-commit · Hook pre-push]`

## A gate proves it can fail
Every gate has a probe that turns it red on a planted violation and green on the fixed state.
`[Gate pre-commit probe rows]`

## A gate with false alarms is switched off, not obeyed
A new check is first held against a state known to be correct; if it reports anything there, the rule is wrong.

## A violation a gate should have caught is a hole in the gate
The finding is the check that stayed silent, not the place.

## A rule lives in one rule, hook or lint, never twice
Sharpen or move it, never write it a second time. `[Gate check-rules duplicate · Gate check-memory duplicate]`

## A new rule exists only with the maintainer's yes
A rule is the most expensive place in the project: loaded every time.

## A skill follows its template
Required fields, steps, acceptance, and no rule, data or history inside it. `[Gate check-skills]`

## For connections, ask the graph first when it is installed
`graphify query`, `explain` or `path` before reading many files; after structural changes, `graphify update`.
