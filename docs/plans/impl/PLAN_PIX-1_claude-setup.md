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
- [x] `CLAUDE.md` points to the rules and names the canon
- [x] Rules `basis` (12 rules), `workflow`, `core` (our hexagon), `ops` (pruned), each with `paths:`, `adr:` and a summary of at most 60 words, all in English
- [x] Templates `rule`, `skill`, `agent`, `data`, `hook.sh`, `unit-readme` with their EXCLUDED blocks
- [x] `rule-context`, `rules_lib`, `check-rules`, `rules-for`, `check-skills`, `check-carriers`, `check-memory`, `memory-guard`, `find-references` ported with probes
- [x] `SKILLS.md` is generated, and pre-commit rejects a stale register
- [x] `MIN_CLI` re-measured against the CLI in use

### PIX-5 — ADR process and decisions
- [x] `docs/ADR/README.md` and `TEMPLATE.md` in both repos; the README states the two-register criterion
- [x] The ADR state table is generated from frontmatter and checked in pre-commit
- [x] Public ADRs for: hexagonal architecture, git flow and history guard (incl. push only when the PR is ready), rules and carriers, feature flow and ticket state, code documentation, typing and lint zones, tooling (measured versions), testing and gates, models and agents, security in agent operation, no write without ticket, AI employees and compute sources, local operator config, everything English, the self-sufficient public repo
- [x] Private ADRs for: what the private repo is for, Jira project, commit identity, series format, content skills stay outside
- [x] Every ADR has a Rejected section and a mechanism in brackets on every decision point
- [x] No public ADR names or links the private repo or other projects of the maintainer

### PIX-2 — history guard
- [x] `install-git-hooks.sh` sets `core.hooksPath` and installs the `main` lock; it fails loudly when it cannot install
- [x] `commit-msg` enforces a Conventional Commits subject, exactly one Co-Authored-By line, at most two text lines
- [x] `pre-commit` runs on a snapshot of exactly the staged state: secret scan, private denylist, author-mail check, forbidden paths, and every gate registered in `precommit-checks.tsv`
- [x] `pre-push` scans every added line of every pushed commit for secrets and denylisted strings, then runs the full verify
- [x] The private denylist and allowed authors come from the gitignored `pixecutive.local.json` (schema and example committed); the public repo never reads from the private companion repo
- [x] A finding names file, line and category, never the matched text
- [x] `.gitignore` covers `.env*`, the local config, `.claude/state/`, `.claude/settings.local.json`, caches and graphify output
- [x] Every hook has a probe that turns red and green

### PIX-3 — safety hooks and ticket state machine
- [x] `ticket.sh` is the only writer of `.claude/state/`, HMAC-signed with a key outside the repo, key format `PIX-NNN`
- [x] Hooks `guard-shell`, `guard-state`, `protect-env`, `require-ticket`, `push-window`, `unblock-window`, `session-start`, `session-end`, `gate-before-pr`, `guard-inprogress`, `guard-done`, `agent-guard`, `agent-done` are ported and wired in `settings.json`
- [x] Skills `push` and `unblock` can only be invoked by the maintainer
- [x] `ticket-types.tsv`, `protected-paths.txt` and `model-routing.md` carry Pixecutive's values
- [x] Jira status and transition IDs come from the local config, never from the repo
- [x] `settings.json` contains no `bypassPermissions` and no allow rule for a path outside this repo
- [x] Every hook has a red/green probe or a guard test

### PIX-6 — flow skills, agents, tracker configuration
- [x] Skills `plan`, `ticket`, `pickup`, `implementation-plan`, `code`, `review`, `decision-sheet`, `comment-audit` ported and in English
- [x] The decision-sheet skill and its template live in the public repo, branded with the Pixecutive design system
- [x] Agents `research`, `adversarial-review`, `design` (on the Pixecutive design system) ported
- [x] Jira site, status, transition and type IDs measured on PIX and supplied through the local config; skills and hooks read them from there
- [x] Every skill passes `check-skills` and appears in the generated register

### Pulled forward from PIX-7
- [x] Comment gate: the code-documentation ADR as a rule set, run on every write and in pre-commit, with a probe per rule
- [x] Identifier gate: every identifier and file name is English (checked against an English word list plus a list of allowed technical terms, not against a list of German words), run on every write and in pre-commit, with probes
- [x] One-export gate, run on every write and in pre-commit, with probes
- [x] Minimal workspace root so the TypeScript gates are type-checked: `package.json` with `packageManager`, strict `tsconfig.json`, `typecheck` script, TypeScript and Node types at versions measured on the day

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
| PIX-3 `ticket.sh` is the only writer of `.claude/state/` | `scripts/ticket.ts` writes through `scripts/lib/ticket/state-store.ts`; a hook that changes state calls `ticket.ts`, none imports the writer | ADR 0003 point 1, with hooks in TypeScript (F3) |
| PIX-6 tracker IDs in the local config (step 8) | The `tracker.transitions` part comes forward into step 5 | The transition hooks of PIX-3 need the IDs, and they may come only from the local config |
| PIX-3 hooks as shell scripts | `.claude/hooks/*.ts`; a blocking hook loads its library inside `try`, so its own failure is exit 2 | Exit 1 does not block in Claude Code; a guard that fails open is none |
| PIX-3 `model-routing.md` values | Pinned agent models measured in CLI 2.1.288; `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=2` in `settings.json` as a second limit behind `agent-guard` | Measured in the CLI binary, 2026-10-04 |
| PIX-4 template `hook.ts` | The `contract` object is exported | A gate reads it from the text; an unused constant would fail the typecheck |
| Pulled forward from PIX-7: gates "run on every write" | `.claude/hooks/quality-guard.ts` runs check-english, check-comments and check-one-export on every written file; it was missing from the step list and is built in step 6 | The acceptance lines demand the run on every write; check-carriers found the hook named but absent |
| PIX-4 `check-carriers` | Wired into pre-commit in step 8, its probe in step 6 | It is red until step 8 delivers the skills and agents that rules and ADRs already name |
| PIX-5 planned mechanisms in ADRs | `Hook architecture-guard, PIX-7` and the like are written `Planned PIX-7: …`, the notation decided for rules, so guard-done holds the card | Sheet rule-mechanisms F2; same meaning, one notation |
| Reference gate from the reference setup: direction of links between carriers | Not built | No ADR of this repo decides a direction; a gate enforces only what is decided |
| PIX-4 "basis (12 rules), workflow, core, ops, each with `paths:`" | `basis` and `workflow` carry no `paths:`, and `basis` holds 13 rules | ADR 0001 point 4 decides both are always loaded, which is what no `paths:` means; the rule that nothing names the private repo came with ADR 0015, after the card |
| PIX-3 `protected-paths.txt` | Free without a package are `docs/`, the root README and `*.spec.ts`/`*.test.ts`; every `.md` under `.claude/` and `CLAUDE.md` is protected | Independent review: the reference setup's `!*.md` let rules, skills and agents be written without a package, against ADR 0003 point 3 |
| PIX-5 ADR 0010 point 7 | Superseded by ADR 0016: only skills that open a window of the maintainer carry `disable-model-invocation` | Sheet skills-and-lessons F1, 2026-10-04 |
| PIX-3 hook `agent-done` and the agent counter of ADR 0009 point 4 | Removed; the harness limit `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=2` holds the number, `check-settings` requires it, `agent-guard` checks only the family (ADR 0017) | Measured 2026-10-04: `SubagentStop` does not name the stopped agent and a failed start is never counted down, so the counter blocked a real start; sheet tool-evaluation F8 |
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
| 4 | Rule system: rule loader, `rule-context` hook, `check-rules`, `rules-for`, budget, probes | probe-rules red and green; rule budget measured | 6c73783 |
| 5 | State machine `ticket.ts` and the safety hooks, `settings.json` with a gate that rejects `bypassPermissions` and allow rules outside the repo (ADR 0010), data files, probes and guard tests | each hook red and green on real hook input | b43bc5e |
| 6 | Registers and document gates: skills register, ADR state table, `check-generated`, `check-skills`, `check-carriers`, `find-references`, `check-memory` with `memory-guard` | each probe red and green; registers regenerate identically | 7804df4 |
| 7 | ADR state tables generated for the ADRs of step 1 | ADR state gate green; denylist finds no private name | 7804df4 |
| 8 | Skills, agents, decision-sheet move, tracker section in the local config with measured PIX IDs | `check-skills` green; register lists every skill | 6e01fd2 |
| 9 | `MIN_CLI` measured; full verify; independent review in fresh context; checklist per file against the rules | review report and checklist sent to the maintainer as a sheet | 1fbbf80, review runs 1–4 |
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
