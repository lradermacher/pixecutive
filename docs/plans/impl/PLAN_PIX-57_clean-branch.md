# PLAN PIX-57 — Clean the branch for the proven asset flow and write the hexagon down

Card: PIX-57 (setup), a series with PIX-7, PIX-56 and PIX-58 on `feat/pix-7-skeleton-toolchain`, one pull request.
Goal: before the merge the branch holds only what the project uses and needs, nothing outdated reaches `main`, the
proven asset flow of PIX-65 has its carriers, and the hexagon is explained in this repo so that nobody needs another
project. Decided on sheet `pix57-clean-branch` (2026-10-12, F1-F8 = a, F5 = b); this plan approved on sheet
`pix57-plan-approval-v2` (2026-10-12, F1-F3 = a).

## Acceptance

- [x] `docs/ADR/README.md` says that an ADR is edited in place until its pull request is merged and superseded from then on — `docs/ADR/README.md` "Until its pull request is merged, an ADR is edited in place" (ea07edb)
- [x] ADR 0022 states the proven asset flow and keeps what still holds; ADR 0019 names the generation tools behind adapters instead of Blender; ADR 0021 gives its reasons in this project's own terms — ADR 0022 points 1-10 with the licenses read at their source, ADR 0019 point 2, ADR 0021 Context without the other backend (ea07edb)
- [x] One new ADR explains the hexagon's craft layer with a neutral worked example of a feature end to end: one term for domain folders, file and type naming, edge translation of exceptions including adapters, configuration by schema, test conventions — ADR 0023 points 1-6, its naming table and the render feature under Mechanics (ea07edb, f4fe4c2)
- [x] Every break of the hexagon rules that the audit found in this branch's code is fixed, including the architecture guard that rejects zod in the core — guard accepts zod and rejects misnamed adapters (c837edd); `globalThis.Date` lint (b97fcf0); adapter and clock names, config schema, exit code table, ports with named types, status through the port, plain errors banned in adapters (f4fe4c2); READMEs (4e218f8, 07f5463); core rule mechanisms aligned with ADR 0011 (this commit)
- [x] The files that serve only the dropped asset path are removed per the approved per-file list, and everything that named them is updated — the 49 files of sheet `pix57-clean-branch` F3 with their exports, data rows, word and `globals` (4e218f8)
- [x] The memory guard, render log and status are served through a general guarded render port with tests — `ILocalRenderer`, `RenderImageService`, `LocalRendererMfluxAdapter` and their specs (f4fe4c2); running step in the status (07f5463)
- [x] `assets.md` carries the approved rules, `core.md` the approved lines of the craft layer, and `CLAUDE.md` names the assets rule — fdae022
- [x] The skills `animate-figure` and `figure-part` exist from the skill template, `blender-character` is gone, and the skills register is regenerated — skills (ea07edb), `blender-character` removed and `SKILLS.md` regenerated (4e218f8)
- [x] The fixed asset layout is removed from `ops.md` and the image check; size and PNG checks stay — 12cbe49, probe-pre-commit 57 cases
- [x] The plans of PIX-7, PIX-56 and PIX-58 match their cards, and the plan of PIX-64 is removed — cards updated first, plans in 07f5463; `PLAN_PIX-64` removed in 4e218f8
- [ ] Every gate and verify-full is green, and an independent review checked the diff

## Inventory

What the reference architecture gave us before (sheet `hexagon-pattern`, 2026-10-04) stands in ADR 0021 point 2 and the naming line of `core.md`: `domain/<Aggregate>/` with camelCase files and a type suffix, zod in the domain, services, exceptions with a key enum, the clock port, adapter files `<port>-<impl>.adapter.ts`, token files only where a container binds. This card adds only what that left open and fixes where the code drifted from it.

Sources: five audits of this session (every file of `git diff origin/main...HEAD` opened once; find-references run
for every removal), kept in the session scratchpad `flow/audit/`.

| Part | State | File |
| --- | --- | --- |
| ADR process rule | extend | `docs/ADR/README.md` |
| Asset decision | rewrite in place | `docs/ADR/0022-…`, `0019-…`, `0021-…` |
| Hexagon craft layer | new | `docs/ADR/0023-the-hexagons-craft-layer.md` (supersedes ADR 0011 point 1 in the term only) |
| Asset rule, core rule | rewrite / extend | `.claude/rules/assets.md`, `.claude/rules/core.md`, `CLAUDE.md` |
| Architecture guard (rejects zod) | fix | `scripts/lib/architecture/judge-architecture.ts`, `scripts/probe-architecture.sh` |
| Lint hole `new globalThis.Date` | fix | `eslint.config.ts`, `scripts/probe-lint.sh` |
| Reference loop, vision, Blender path (about 45 files) | remove | per-file list approved on the sheet (F3) |
| Guarded render | extend | core `domain/Render/`, `port/outgoing/localRenderer.interface.ts`, `application/service/renderImage.service.ts`; infrastructure `adapter/Render/localRenderer-mflux.adapter.ts` (from the Qwen reference adapter) |
| Clock adapter (file name breaks the pattern) | rename | `adapter/Time/clock-system.adapter.ts`, class `ClockSystemAdapter` |
| App configuration (no schema, falls back to `missing`) | rewrite | core `domain/Render/renderConfig.schema.ts`; app `src/renderConfig.ts` |
| CLI edge (one exit code for every key) | rewrite | app `src/cli/renderImage.handler.ts`, `showRenderStatus.handler.ts`, `renderExitCode.ts` |
| Skills | new / remove | `.claude/skills/animate-figure/`, `figure-part/`; `blender-character/` removed |
| Registers and data rows | update | `SKILLS.md` (generated), `skill-conformance.tsv`, `precommit-checks.tsv` rows 48-49, `model-routing.md` row, word list |
| Asset layout | remove | `.claude/rules/ops.md` lines 33-35, `scripts/lib/guard/check-images.ts` layout part with its probe cases |
| Plans | rewrite / remove | `PLAN_PIX-7`, `PLAN_PIX-56`, `PLAN_PIX-58`; `PLAN_PIX-64` removed; this plan |
| Small defects | fix | `ci.yml:1`, `templates/unit-readme.md:24` (the sentence about a generated index goes), READMEs of asset-pipeline, companion, infrastructure, `package.json` (`globals`) |

## Placement

- **Asset pipeline:** it stays an app of the hexagon (ADR 0019; maintainer, 2026-10-04: the generator does not break
  out of the architecture). What a figure is (part layers, color slots, shoe class, trouser variant per shoe class,
  layer order) belongs in the core, because the office needs the same facts at runtime. Every generation tool is an
  adapter in infrastructure behind a core port; its Python steps lie beside it as the adapter's internals, as
  `cutout.py` does today. The manifest is a schema in protocol, `apps/asset-pipeline` is the composition root and the
  command line, and the skills call its commands. A tools folder outside the hexagon is the build script that ADR 0019
  rejected. This card writes the placement into ADR 0019 and builds the render port as the first adapter; PIX-66
  moves the remaining tools.
- **Decisions** go into ADRs, **rules that can be broken** into `core.md`/`assets.md` with their mechanism, **steps** into
  skills, **values a mechanism reads** into data files (ADR 0001). Nothing names the reference project (basis rule).
- **Render:** the guard decides nothing about images, it decides whether a process may run; it stays an adapter
  (touches processes and files). The use case "render one image and log it" is a core service over the port; the
  outcome types are named domain types instead of inline shapes. The app only wires and translates (core rule
  "Where new code goes").
- **Status** reads the lock and the log: files, so it is a port method of the renderer, not app code.
- **Configuration** is parsed by a core schema at the app's start; a missing value stops the start.

## Standards the build follows

- Rules: basis, workflow, core, ops, assets as rewritten here. Every changed file passes quality-guard.
- Every removal only as approved per file; every rename leaves no old name anywhere (basis rule on renames).
- A gate is wired only after its probe turned red and green.

## Behavior

- `pnpm assets render <prompt file> <input image> <seed>` renders one image under the memory guard and writes one log row;
  `pnpm assets status` prints the running render or idle, memory, and the last log rows. Every exception key has its own
  exit code and message.
- The architecture guard lets the core import `zod` (ADR 0021) and still rejects every other package.

## Test plan

- Core: `RenderImageService` with an in-memory renderer fake; `renderConfig.schema` with valid and invalid input.
- Infrastructure: `LocalRendererMfluxAdapter` with a fake process and fake memory readings (refuses a second render,
  refuses under pressure, stops at the limit, writes one row); `ClockSystemAdapter`.
- App: each handler and `renderExitCode` covers every key (a type check makes a missing key a compile error).
- Probes: architecture guard (zod green, other packages red), lint (`new globalThis.Date` red), image check without
  the layout cases.
- Gates: check-docs, check-carriers, check-rules, check-skills, check-generated, check-tests, verify-full.

## Out of scope

- Moving the remaining scratchpad tools into their adapters and the figure model into the core: PIX-66.
- Server stack ADR, binding modules, request validation, persistence, transactions: they need the stack (F5 = b).
- The company key: PIX-35. String unions in merged gate code: own Backlog card.

## Changed on the way

- 2026-10-12: the card was rewritten from "develop assets through Qwen reference and Blender rebuild" to this cleanup
  (sheet `pix57-clean-branch`); the earlier steps 1-6 (reference loop, cutout, Blender skill, asset layout) are what
  this card removes. The pipeline itself moves to PIX-66.
- 2026-10-12: the placement of the asset pipeline was checked against ADR 0019 and stays inside the hexagon; a tools
  folder outside it was proposed and withdrawn. The unit map is not part of this card; only the template sentence
  that promises it goes.
- 2026-10-12: the skills of step 7 are built in step 1, because the rewritten ADR 0022 names them as the carriers of
  its points and `check-carriers` stays red without them. ADR 0022 is renamed to
  `0022-assets-are-drawn-from-our-own-templates-and-checked-by-eye.md`, since its old title stated the dropped path.
- 2026-10-12: step 5 is committed before step 4, because a spec on the removal list uses `Date` in the core and the
  closed lint hole turns it red; the app keeps only `status` until step 6 rewrites it. The removals also take the
  unused word of the vision service and the unused dependency `globals`.
- 2026-10-12: the status had lost the running render's step when the guard moved into the adapter, which PIX-56's
  third acceptance line asks for; the adapter now writes the step into its lock, with a spec case. The cards PIX-7,
  PIX-56 and PIX-58 were brought to today's state first, then their plans.
- 2026-10-12: review run 1 was red with 14 findings; the maintainer kept all of them on sheet `pix57-review-1-diffs`
  (F12 = a: the machine lookups go behind a core port). Each is its own step from 11 on, its diff shown on the sheet.

## Open questions

- **Decided by the maintainer on sheet `pix57-plan-approval-v2`:** the three `core.md` lines (F2 = a) and the two
  naming conventions for ADR 0023 (F3 = a); new rules and conventions are the maintainer's call (ADR 0001 point 9).
- **I decide:** file and type names inside the conventions, the step order below, the render command's arguments.

## Order

| Step | What | Check | Status |
| --- | --- | --- | --- |
| 1 | ADR README sentence; ADR 0019, 0021, 0022 rewritten in place; ADR 0023 written; state tables regenerated; the skills of step 7 | `check-docs`, `check-carriers`, `generate-adr-state --check` | ea07edb |
| 2 | `core.md` lines, `assets.md`, `CLAUDE.md` | `check-rules` | fdae022 |
| 3 | Architecture guard accepts zod in the core and rejects an adapter file outside `<port>-<technology>.adapter.ts`; probe cases first red, then green | `bash scripts/probe-architecture.sh` | c837edd |
| 4 | Lint selector for `new globalThis.Date`; probe case first red, then green | `bash scripts/probe-lint.sh` | b97fcf0 |
| 5 | Removals per the approved list, with every row, export, script, dependency and word that named them | `pnpm typecheck`, `pnpm test`, `check-skills`, `check-generated` | 4e218f8 |
| 6 | Guarded render port, service, adapter, clock rename, config schema, CLI handlers and exit codes, READMEs; the lint ban on plain errors widened to the infrastructure package, probe first red, then green | `pnpm test`, `pnpm lint`, the architecture guard on every new file | f4fe4c2 |
| 7 | Skills `animate-figure` and `figure-part`; conformance rows; register regenerated | `check-skills`, `check-generated` | built in step 1 |
| 8 | Asset layout out of `ops.md` and `check-images`; probe cases adjusted | `bash scripts/probe-pre-commit.sh` | 12cbe49 |
| 9 | Plans of PIX-7, PIX-56, PIX-58 rewritten; plan of PIX-64 removed; `ci.yml:1`, unit-readme template, routing row | `check-docs`, `generate-adr-state --check` | 07f5463 |
| 10 | Full gate, every box with its evidence, independent review | `node scripts/verify-full.ts`, `ticket.ts boxes`, review record | review run 1 on 326986d: red, 14 findings, all kept (sheet `pix57-review-1-diffs`) |
| 11 | Review finding 1: the lock carries the PID, a dead process's lock is cleared, interrupts end the render with a log row and `render.interrupted` | adapter spec; a real Ctrl-C on the built app | 55ef956 |
| 12 | Review finding 2: file system and memory failures answer `render.storage_failed` and `render.memory_unreadable` | adapter spec | open |
| 13 | Review finding 3: the app checks at start that mflux and the LoRA exist | config spec | open |
| 14 | Review finding 4: one case per exit key in `exitAnswer.spec.ts` | `pnpm test` | open |
| 15 | Review finding 5: `RenderImageCommand` as the use case input | `pnpm typecheck`, `pnpm test` | open |
| 16 | Review finding 6: ADR 0023 supersedes ADR 0011's value object row; ADR 0021 says `<technology>` | `check-docs`, `check-carriers`, `generate-adr-state --check` | open |
| 17 | Review finding 7: ADR 0022 Confirmation names what carries each point | `check-docs` | open |
| 18 | Review finding 8: the PIX-58 plan names the video guard where it is | `check-docs` | open |
| 19 | Review finding 9: a spec for the render job schema | `pnpm test` | open |
| 20 | Review finding 10: fourteen unused spell-list words removed | `check-english --all` | open |
| 21 | Review finding 11: stale sentences in three docs | `check-english`, `check-docs` | open |
| 22 | Review finding 13: case-insensitive PNG check with a probe case | `bash scripts/probe-pre-commit.sh` | open |
| 23 | Review finding 14: an image of an earlier run is removed before a run | adapter spec | open |
| 24 | Review finding 12 (F12 = a): the machine lookups behind the core port `IRenderMachine` | `pnpm test`, the architecture guard on the new files | open |
| 25 | Review run 2 over steps 11 to 24 | review record | open |
