# PLAN_PIX-1 — the Claude setup, in one pull request

Epic PIX-1, cards PIX-2 (history guard), PIX-3 (safety hooks and ticket state machine), PIX-4 (rules, templates,
registers), PIX-5 (ADR process and decisions), PIX-6 (flow skills and agents). One branch from `main`
(`feat/pix-1-claude-setup`), one pull request, decided by the maintainer on 2026-10-04.

Goal: every session in this repo loads rules that bind it, every file is written under them, and mechanisms enforce
them, so work never again happens without ticket, plan or rules.

## Decisions this plan builds on

- Everything in the repo is English; nothing in the public repo names, links or reads the private companion repo or
  other projects of the maintainer. Operator-private values come from the gitignored `pixecutive.local.json` (schema
  and example committed) or `.env`.
- Hooks and gates are TypeScript run directly by Node; shell stays only for thin git hook entry points and the
  black-box probes that drive them (2026-10-04, F3).
- The architecture is hexagonal (`packages/core`, `packages/infrastructure`, `packages/protocol`, `apps/server`,
  `apps/client`, `apps/web` outside the hexagon); the core rule describes it before any package exists.
- Commits stay local while the branch is in progress; it is pushed once, when the pull request is ready.

## Acceptance

Taken verbatim from the cards; changes against the cards are listed under "Changes against the cards".

### PIX-4 — rules, templates, registers
- [ ] `CLAUDE.md` points to the rules and names the canon
- [ ] Rules `basis` (12 rules), `workflow`, `core` (our hexagon), `ops` (pruned), each with `paths:`, `adr:` and a summary of at most 60 words, all in English
- [ ] Templates `rule`, `skill`, `agent`, `data`, `hook.sh`, `unit-readme` with their EXCLUDED blocks
- [ ] `rule-context`, `rules_lib`, `check-rules`, `rules-for`, `check-skills`, `check-carriers`, `check-memory`, `memory-guard`, `find-references` ported with probes
- [ ] `SKILLS.md` is generated, and pre-commit rejects a stale register
- [ ] `MIN_CLI` re-measured against the CLI in use

### PIX-5 — ADR process and decisions
- [ ] `docs/ADR/README.md` and `TEMPLATE.md` in both repos; the README states the two-register criterion
- [ ] The ADR state table is generated from frontmatter and checked in pre-commit
- [ ] Public ADRs for: hexagonal architecture, git flow and history guard (incl. push only when the PR is ready), rules and carriers, feature flow and ticket state, code documentation, typing and lint zones, tooling (measured versions), testing and gates, models and agents, security in agent operation, no write without ticket, AI employees and compute sources, local operator config, everything English, the self-sufficient public repo
- [ ] Private ADRs for: what the private repo is for, Jira project, commit identity, series format, content skills stay outside
- [ ] Every ADR has a Rejected section and a mechanism in brackets on every decision point
- [ ] No public ADR names or links the private repo or other projects of the maintainer

### PIX-2 — history guard
- [ ] `install-git-hooks.sh` sets `core.hooksPath` and installs the `main` lock; it fails loudly when it cannot install
- [ ] `commit-msg` enforces a Conventional Commits subject, exactly one Co-Authored-By line, at most two text lines
- [ ] `pre-commit` runs on a snapshot of exactly the staged state: secret scan, private denylist, author-mail check, forbidden paths, and every gate registered in `precommit-checks.tsv`
- [ ] `pre-push` scans every added line of every pushed commit for secrets and denylisted strings, then runs the full verify
- [ ] The private denylist and allowed authors come from the gitignored `pixecutive.local.json` (schema and example committed); the public repo never reads from the private companion repo
- [ ] A finding names file, line and category, never the matched text
- [ ] `.gitignore` covers `.env*`, the local config, `.claude/state/`, `.claude/settings.local.json`, caches and graphify output
- [ ] Every hook has a probe that turns red and green

### PIX-3 — safety hooks and ticket state machine
- [ ] `ticket.sh` is the only writer of `.claude/state/`, HMAC-signed with a key outside the repo, key format `PIX-NNN`
- [ ] Hooks `guard-shell`, `guard-state`, `protect-env`, `require-ticket`, `push-window`, `unblock-window`, `session-start`, `session-end`, `gate-before-pr`, `guard-inprogress`, `guard-done`, `agent-guard`, `agent-done` are ported and wired in `settings.json`
- [ ] Skills `push` and `unblock` can only be invoked by the maintainer
- [ ] `ticket-types.tsv`, `protected-paths.txt` and `model-routing.md` carry Pixecutive's values
- [ ] Jira status and transition IDs come from the local config, never from the repo
- [ ] `settings.json` contains no `bypassPermissions` and no allow rule for a path outside this repo
- [ ] Every hook has a red/green probe or a guard test

### PIX-6 — flow skills, agents, tracker configuration
- [ ] Skills `plan`, `ticket`, `pickup`, `implementation-plan`, `code`, `review`, `decision-sheet`, `comment-audit` ported and in English
- [ ] The decision-sheet skill and its template live in the public repo, branded with the Pixecutive design system
- [ ] Agents `research`, `adversarial-review`, `design` (on the Pixecutive design system) ported
- [ ] Jira site, status, transition and type IDs measured on PIX and supplied through the local config; skills and hooks read them from there
- [ ] Every skill passes `check-skills` and appears in the generated register

### Pulled forward from PIX-7
- [ ] Comment gate: the code-documentation ADR as a rule set, run on every write and in pre-commit, with a probe per rule
- [ ] Identifier gate: every identifier and file name is English (checked against an English word list plus a list of allowed technical terms, not against a list of German words), run on every write and in pre-commit, with probes
- [ ] One-export gate, run on every write and in pre-commit, with probes
- [ ] Minimal workspace root so the TypeScript gates are type-checked: `package.json` with `packageManager`, strict `tsconfig.json`, `typecheck` script, TypeScript and Node types at versions measured on the day

## Changes against the cards

| Card line | Change | Reason |
| --- | --- | --- |
| PIX-3 `ticket.sh`, PIX-4 `rules_lib` and the `.sh`/`.py` gate names | Written as TypeScript (`scripts/*.ts`, `.claude/hooks/*.ts`) with the same responsibilities; thin shell entry points only where git or Claude Code calls an executable | F3, 2026-10-04 |
| PIX-7 comment gate, identifier gate, one-export gate, minimal workspace root | Pulled into this pull request | Every file of this pull request must be checked against the rules by a mechanism, not by judgment |
| PIX-2 existing local commit `48dc4a8` | Used only as reference; every file is rewritten under the rules on this branch | F2, 2026-10-04 |
| PIX-5 ADRs in step 7 | Written in step 1, before the rules that point to them | A rule enforces a decision; the decision has to exist first |
| PIX-4 template `hook.sh` | `hook.ts` with the contract as a typed object | Hooks are TypeScript (F3) |
| PIX-6 tracker IDs in the local config | The local config schema gains a `tracker` section | Self-sufficient public repo, operator values outside it |
| PIX-4 rules without a mechanism | Every rule gets a bracket: a real mechanism, `[Prose: reason]`, or `[Planned PIX-NNN: mechanism]`; `check-rules mechanism` enforces it, and `guard-done` (step 5) keeps a card out of Done while a rule names it as planned | Sheet rule-mechanisms F1, F2, 2026-10-04 |
| PIX-2 forbidden paths | Images and videos only as PNG or SVG assets under `apps/web/assets/`, at most 256 KB, checked in pre-commit and pre-push; the ops rule is scoped to screenshots, recordings and photos | Sheet rule-mechanisms F3, 2026-10-04 |
| PIX-4 `paths:` of `core` and `ops` | `x/**` written as `x/*` for one-segment directories, so the pattern stays anchored at the root | `check-rules structure`: `x/**` shrinks to `x` and would match at every level |
| PIX-7 German-identifier detector | Becomes an English-only check: identifiers must consist of English words or allowed technical terms | Maintainer's note on the plan approval, 2026-10-04 |

## Open design point

Which English word list the identifier gate uses (bundled file, npm package, system dictionary) is measured in step 2
against real identifiers before it is chosen; the result is recorded in the tooling ADR.

Each change goes as a comment onto its card when this plan is approved.

## Inventory

The repo has `LICENSE` and `README.md`, nothing else. Every file below is **new**. The parked reference commit and an
earlier setup of the maintainer are sources to read, never to copy: each file is rewritten in English under the rules
of step 1 and checked by the gates of step 2.

| Area | Files |
| --- | --- |
| Rules and entry | `CLAUDE.md`, `.claude/rules/{basis,workflow,core,ops}.md` |
| Templates | `.claude/templates/{rule.md,skill.md,agent.md,data.md,hook.sh,unit-readme.md}` |
| ADRs | `docs/ADR/{README.md,TEMPLATE.md}`, one file per decision listed under PIX-5 |
| Workspace root | `package.json`, `tsconfig.json`, `pnpm-workspace.yaml`, `.gitignore`, `.editorconfig` |
| Shared libraries | `scripts/lib/*.ts`: frontmatter and data-file reader, rule loader, command lexer, secret patterns, local config reader |
| Gates | `scripts/check-*.ts`, `scripts/generate-*.ts`, each with `scripts/probe-*.sh` |
| History guard | `.githooks/{commit-msg,pre-commit,pre-push}`, `scripts/install-git-hooks.sh`, `.claude/data/precommit-checks.tsv` |
| Claude hooks | `.claude/hooks/*.ts` and `.claude/settings.json` |
| State machine | `scripts/ticket.ts`, `.claude/data/{ticket-types.tsv,protected-paths.txt,model-routing.md}` |
| Skills and agents | `.claude/skills/<name>/SKILL.md`, decision-sheet template, `.claude/agents/<name>.md`, generated `.claude/SKILLS.md` |
| Operator config | `pixecutive.local.schema.json`, `pixecutive.local.example.json` |

Placement follows the core rule: everything here is tooling around the repo, none of it is product code, so nothing
lives under `packages/` or `apps/`.

## Order

Every step ends green: the gates built so far pass on the whole branch. A gate is wired into pre-commit only after its
probe turns red and green. The status column is filled with the commit that closes the step.

| Step | What | Check | Status |
| --- | --- | --- | --- |
| 1 | ADR README and template, then every public ADR of 2026-10-03 and 2026-10-04, then the rules, `CLAUDE.md` and templates that point to them | every link from a rule, template or `CLAUDE.md` to an ADR resolves; every rule has `adr:` and a summary ≤ 60 words (counted by script); maintainer reads ADRs and rules before step 2 | 19cac9a |
| 2 | Workspace root and shared libraries; comment, identifier and one-export gates with probes | `pnpm typecheck`; each probe red and green | 19cac9a |
| 3 | History guard rewritten under the rules: libraries in TypeScript, thin git hooks, install script, a branch-name check (`feat/pix-NNN-short`, ADR 0004), probes | all guard probes green; comment gate green on every guard file | 19cac9a |
| 4 | Rule system: rule loader, `rule-context` hook, `check-rules`, `rules-for`, budget, probes | probe-rules red and green; rule budget measured | open |
| 5 | State machine `ticket.ts` and the safety hooks, `settings.json` with a gate that rejects `bypassPermissions` and allow rules outside the repo (ADR 0010), data files, probes and guard tests | each hook red and green on real hook input | open |
| 6 | Registers and document gates: skills register, ADR state table, `check-generated`, `check-skills`, `check-carriers`, `find-references`, `check-memory` with `memory-guard` | each probe red and green; registers regenerate identically | open |
| 7 | ADR state tables generated for the ADRs of step 1 | ADR state gate green; denylist finds no private name | open |
| 8 | Skills, agents, decision-sheet move, tracker section in the local config with measured PIX IDs | `check-skills` green; register lists every skill | open |
| 9 | `MIN_CLI` measured; full verify; independent review in fresh context; checklist per file against the rules | review report and checklist sent to the maintainer as a sheet | open |
| 10 | The maintainer checks the branch locally; only after the maintainer's yes is the branch pushed and the pull request opened | the maintainer's yes | open |

## Test plan

- Every gate and hook has a probe that turns red on a planted violation and green on the fixed state, run in a
  throwaway repo; every probe is registered in `precommit-checks.tsv`.
- The guard checks its own commits on this branch from step 3 on; steps 1 and 2 are committed only after step 3 is
  in place, so no commit of this branch passes unchecked.
- Before the pull request, the comment, identifier and one-export gates run with `--all` over the whole branch.

## Out of scope

| Item | Why |
| --- | --- |
| ESLint, Prettier, Vitest, CI workflows, architecture guard | PIX-7; they need the first package and are not part of the Claude setup |
| `ui-lib` and `surfaces` rules | No UI package yet |
| Migration skill and persistence gates | Persistence is not chosen |
| Private repo structure; the five private ADRs of PIX-5 | They live in the private repo and are committed there alongside step 7, never in this pull request; the rest of its structure is PIX-8 |
| GitHub rulesets and secret scanning | PIX-9; needs the CI from PIX-7 |

## Open questions

None that block step 1. The maintainer reads the rules after step 1 before anything else is built on them.
