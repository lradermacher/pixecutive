# PLAN PIX-57 — Clean the branch for the proven asset flow and write the hexagon down

Card: PIX-57 (setup), a series with PIX-7, PIX-56 and PIX-58 on `feat/pix-7-skeleton-toolchain`, one pull request.
Goal: before the merge the branch holds only what the project uses and needs, nothing outdated reaches `main`, the
proven asset flow of PIX-65 has its carriers, and the hexagon is explained in this repo so that nobody needs another
project. Decided on sheet `pix57-clean-branch` (2026-10-12, F1-F8 = a, F5 = b); this plan approved on sheet
`pix57-plan-approval-v2` (2026-10-12, F1-F3 = a).

## Acceptance

- [x] `docs/ADR/README.md` says that an ADR is edited in place until its pull request is merged and superseded from then on — `docs/ADR/README.md` "Until its pull request is merged, an ADR is edited in place" (ea07edb)
- [x] ADR 0022 states the proven asset flow and keeps what still holds; ADR 0019 names the generation tools behind adapters instead of Blender; ADR 0021 gives its reasons in this project's own terms — ADR 0022 points 1-10 with the licenses read at their source, ADR 0019 point 2, ADR 0021 Context in this project's own terms (ea07edb)
- [x] One new ADR explains the hexagon's craft layer with a neutral worked example of a feature end to end: one term for domain folders, file and type naming, edge translation of exceptions including adapters, configuration by schema, test conventions — ADR 0023 points 1-6, its naming table and the render feature under Mechanics (ea07edb, f4fe4c2)
- [x] Every break of the hexagon rules that the audit found in this branch's code is fixed, including the architecture guard that rejects zod in the core — guard accepts zod and rejects misnamed adapters (c837edd); `globalThis.Date` lint (b97fcf0); adapter and clock names, config schema, exit code table, ports with named types, status through the port, plain errors banned in adapters (f4fe4c2); READMEs (4e218f8, 07f5463); core rule mechanisms aligned with ADR 0011 (326986d)
- [x] The files that serve only the dropped asset path are removed per the approved per-file list, and everything that named them is updated — the 49 files of sheet `pix57-clean-branch` F3 with their exports, data rows, word and `globals` (4e218f8)
- [x] The memory guard, render log and status are served through a general guarded render port with tests — `ILocalRenderer`, `RenderImageService`, `LocalRendererMfluxAdapter` and their specs (f4fe4c2); running step in the status (07f5463)
- [x] `assets.md` carries the approved rules, `core.md` the approved lines of the craft layer, and `CLAUDE.md` names the assets rule — fdae022
- [x] The skills `animate-figure` and `figure-part` exist from the skill template, `blender-character` is gone, and the skills register is regenerated — skills (ea07edb), `blender-character` removed and `SKILLS.md` regenerated (4e218f8)
- [x] The fixed asset layout is removed from `ops.md` and the image check; size and PNG checks stay — 12cbe49, probe-pre-commit 57 cases
- [x] The plans of PIX-7, PIX-56 and PIX-58 match their cards, and the plan of PIX-64 is removed — cards updated first, plans in 07f5463; `PLAN_PIX-64` removed in 4e218f8
- [x] Every gate and verify-full is green, and an independent review checked the diff — verify-full green on the commit of step 54; review run 1 on 326986d (14 findings, fixed in steps 11-24) and run 2 on 3e11007 (4 findings and 8 notes, fixed in steps 26-33), run 3 on 45b9916 (4 findings and 4 notes, fixed in steps 35-37), run 4 on b31fb5f (14 findings, fixed in steps 39-41), run 5 on 03d7325 (6, fixed in step 43), run 6 on 7dbc7c5 (green; its 5 points fixed in steps 45-46), run 7 on 7ce4d61 (9, fixed in step 48), run 8 on 482d786 (green; its 6 points fixed in step 50), run 9 on c0d2682 (8, fixed in step 52), run 10 on c7fb654 (green; its 7 points fixed in step 54)

## Inventory

What sheet `hexagon-pattern` (2026-10-04) already settled stands in ADR 0021 point 2 and the naming line of `core.md`: `domain/<Aggregate>/` with camelCase files and a type suffix, zod in the domain, services, exceptions with a key enum, the clock port, adapter files `<port>-<technology>.adapter.ts`, token files only where a container binds. This card adds only what that left open and fixes where the code drifted from it.

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
  adapter in infrastructure behind a core port; its Python steps lie beside it as the adapter's internals, started
  as a process. The manifest is a schema in protocol, `apps/asset-pipeline` is the composition root and the
  command line, and the skills call its commands. A tools folder outside the hexagon is the build script that ADR 0019
  rejected. This card writes the placement into ADR 0019 and builds the render port as the first adapter; PIX-66
  moves the remaining tools.
- **Decisions** go into ADRs, **rules that can be broken** into `core.md`/`assets.md` with their mechanism, **steps** into
  skills, **values a mechanism reads** into data files (ADR 0001). Nothing names another project (basis rule).
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

- `pnpm assets render <prompt file> <input image> <seed> [<width>x<height>]` renders one image under the memory guard and writes one log row;
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
- 2026-10-12: review run 2 was red with 4 findings and 8 notes, two of them slips in the fixes of run 1; all are
  measured defects and are fixed as steps 26 to 32. The end of a run and the commands were sets of strings against the
  basis rule (the maintainer); step 33 makes them enums. A third run needs the maintainer's yes.
- 2026-10-12: review run 3 (with the maintainer's yes) was red with 4 findings and 4 notes, none a blocker; all are
  measured defects or specs that passed without their fix, fixed in steps 35 to 37, each new case checked red
  without its fix.
- 2026-10-12: a real mflux render (768x768, 175 s), a second render refused while one runs, and Ctrl-C to the whole
  process group (exit 9, no mflux left, no lock) were measured on this Mac. Review run 4 over the whole card (the
  maintainer asked for it) found 14 more; all are fixed in steps 39 to 41, commit bodies stay as written.
- 2026-10-12: review run 5 over 03d7325 found 3 findings and 3 notes in those fixes; all are fixed in step 43, each
  new case checked red without its fix.
- 2026-10-12: review run 6 was green; its should-fix and notes went to PIX-69, and the core's lint hole for random
  IDs had gone to PIX-67. The maintainer: a feature ships without known errors, so both are fixed in this card as
  steps 45 and 46, and the two cards are closed.
- 2026-10-12: review run 7 found that step 45 let the bar tqdm draws again at exit clear the error, and 8 smaller
  points; all are fixed in step 48, the complaint now in its own unit, each fix checked red without it.
- 2026-10-12: review run 8 was green with one regression in rare streams and five smaller points, two of them in
  code older than this round; all are fixed in step 50. The start value of the step count is an equivalent mutant: the
  first bar resets it, so no case can tell it apart.
- 2026-10-12: review run 9 showed that the third rule in a row on mflux's output still missed real Python output, so
  the input changed instead of a fourth rule: the complaint now follows the shape Python gives its output (indented
  continuation lines, warnings, tracebacks, tqdm's time), fixed in step 52.
- 2026-10-12: review run 10 was green on real Python output (tracebacks, logging, tqdm, a real libc++abi abort) and
  measured seven smaller points, one of them the macOS crash report the SIGABRT case left on every test run; all are
  fixed in step 54.

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
| 12 | Review finding 2: file system and memory failures answer `render.storage_failed` and `render.memory_unreadable` | adapter spec | d2b970c |
| 13 | Review finding 3: the app checks at start that mflux and the LoRA exist | config spec | 95bb96e |
| 14 | Review finding 4: one case per exit key in `exitAnswer.spec.ts` | `pnpm test` | 4e13823 |
| 15 | Review finding 5: `RenderImageCommand` as the use case input | `pnpm typecheck`, `pnpm test` | ef47b8a |
| 16 | Review finding 6: ADR 0023 supersedes ADR 0011's value object row; ADR 0021 says `<technology>` | `check-docs`, `check-carriers`, `generate-adr-state --check` | 0014c3f |
| 17 | Review finding 7: ADR 0022 Confirmation names what carries each point | `check-docs` | 7fb78b7 |
| 18 | Review finding 8: the PIX-58 plan names the video guard where it is | `check-docs` | 3831b01 |
| 19 | Review finding 9: a spec for the render job schema | `pnpm test` | 29936d7 |
| 20 | Review finding 10: fourteen unused spell-list words removed | `check-english --all` | 6fe955d |
| 21 | Review finding 11: stale sentences in three docs | `check-english`, `check-docs` | b0b8db8 |
| 22 | Review finding 13: case-insensitive PNG check with a probe case | `bash scripts/probe-pre-commit.sh` | 241d63b |
| 23 | Review finding 14: an image of an earlier run is removed before a run | adapter spec | 1e82971 |
| 24 | Review finding 12 (F12 = a): the machine lookups behind the core port `IRenderMachine` | `pnpm test`, the architecture guard on the new files | 3e11007 |
| 25 | Review run 2 over steps 11 to 24 | review record | run 2 on 3e11007: red, 4 findings and 8 notes, all fixed in steps 26-32 |
| 26 | Run 2, R1: a failed step write ends the run as `render.storage_failed` instead of crashing | adapter spec; built app with the renders folder removed | 9b4c3b6 |
| 27 | Run 2, R2: mflux writes a side file, so an interrupted re-run keeps the earlier image | adapter spec; built app with Ctrl-C on a re-run | 9c9f1a5 |
| 28 | Run 2, R3: the lock is atomic, carries the IDs of Node and mflux, and an empty one is stale | adapter spec; built app with an empty lock | 822e8d5 |
| 29 | Run 2, R4: a second interrupt ends a model that ignores the first | adapter spec | fe7a4e9 |
| 30 | Run 2, R5: the LoRA search covers every snapshot and keys a broken cache | machine adapter spec | 283b99e |
| 31 | Run 2, R6: git's complaint reaches the user once | machine adapter spec | 550bd7c |
| 32 | Run 2, R7: ADR 0023 and the adapter's JSDoc say what the code does | `check-docs`, `generate-adr-state --check` | 45b9916 |
| 33 | The end of a run and the command line's commands are enums, not strings (basis rule) | `pnpm lint`, `pnpm test` | 45b9916 |
| 34 | Review run 3, only with the maintainer's yes | review record | run 3 on 45b9916 (the maintainer's yes): red, 4 findings and 4 notes, fixed in steps 35-37 |
| 35 | The render lock as its own unit (atomic take, rewrite through a side file, mflux named from its start); a second interrupt ends the model whatever stopped the run; a start failure thrown at once, an unmovable image and a leftover side file end as keys | lock, disk and adapter specs, each case red without its fix (mutation) | 93261e6 |
| 36 | The machine adapter reads its working folder inside the keyed try | machine adapter spec | 93261e6 (committed with step 35) |
| 37 | The command line checks the command before it reads the configuration | composition root spec | b31fb5f |
| 38 | Review run 4 over the whole card, which the maintainer asked for | review record | run 4 on b31fb5f: red, 11 of 11 lines fulfilled, 14 findings, fixed in steps 39-41 |
| 39 | Render: strict arguments, inputs checked before the lock, mflux's complaint kept, the field named, log time in UTC, the core free of tool names, the Hugging Face cache variables honored; a case red without each fix | `pnpm test`, mutations | committed with step 41 |
| 40 | Docs: ADR 0018 point 2 edited in place instead of superseded, ADR 0019 Confirmation, ADR 0022 points 1 and 6, ADR 0023 point 3 and Mechanics, core and assets rules, the PIX-56 plan's cache claim | `check-docs`, `check-carriers`, `check-rules` | committed with step 41 |
| 41 | Findings outside this card as Backlog cards | the cards' keys | PIX-67, PIX-68; 03d7325 |
| 42 | Review run 5 over 03d7325, with the maintainer's yes | review record | run 5 on 03d7325: red, 3 findings and 3 notes, fixed in step 43 |
| 43 | The weights must be a file; mflux's complaint only from its error output, on one line, its error line first; the cache paths expanded as the hub does; the missing input key in the JSDoc; a static `node:child_process` probe case; a case red without each fix | `pnpm test`, mutations, `bash scripts/probe-architecture.sh` | 7dbc7c5 |
| 44 | Review run 6 over 7dbc7c5, with the maintainer's yes | review record | run 6 on 7dbc7c5: green, 1 should-fix and 4 notes; the maintainer: nothing known ships, so all are fixed in steps 45-46 |
| 45 | Render: `isFile` never throws; a complaint split across chunks is joined; an error before a later step no longer counts; the error word keeps its boundary; `HF_HOME` expanded before the cache path as the hub does (was PIX-69) | `pnpm test`, mutations | c3db048 |
| 46 | Lint: random IDs and `performance.now()` rejected in the core, probe cases red first (was PIX-67) | `bash scripts/probe-lint.sh` | 7ce4d61 |
| 47 | Review run 7 over steps 45-46 | review record | run 7 on 7ce4d61: red, a regression (the tqdm bar drawn again at exit cleared the error) and 8 smaller points, fixed in step 48 |
| 48 | mflux's complaint as its own unit `mfluxComplaint.ts`: only a step past every earlier one clears an error, stderr decoded as one stream, a bounded waiting piece; lint for `crypto` and `performance` scope-aware and for every global-object prefix, `globalThis.Math.random` too; the cache path joined as Python does, only the environment's own variables expanded; a case red without each fix | `pnpm test`, mutations, `bash scripts/probe-lint.sh` | 482d786 |
| 49 | Review run 8 over step 48 | review record | run 8 on 482d786: green, 1 regression in rare streams, 1 comment slip and 4 notes; the maintainer ships nothing known, so all are fixed in step 50 |
| 50 | mflux's complaint keeps the start of a line that never ends, counts each bar on its own, reads text right after a bar, and lets a warning win only when nothing else was said; the cache join and the doc block of `renderConfig.ts`; `mfluxComplaint.ts` in ADR 0023; the lint message for `globalThis.Math` only on `random`; a case red without each fix, an equivalent mutant named | `pnpm test`, mutations, `bash scripts/probe-lint.sh` | c0d2682 |
| 51 | Review run 9 over step 50 | review record | run 9 on c0d2682: red, the source line under a Python warning won over the real abort, and 7 smaller points; fixed in step 52 |
| 52 | mflux's complaint follows the shape of Python output: an indented line continues the one above, a warning stays a warning, a tqdm bar is known by its time, a bar that falls back starts its own count, an error may be lower case; a signal is named instead of `exit null`; the cache join keeps no second slash; a case red without each rule (the bound of the waiting piece protects memory only, so no case can see it) | `pnpm test`, mutations | c7fb654 |
| 53 | Review run 10 over step 52 | review record | run 10 on c7fb654: green, 2 should-fix and 5 notes, all measured; fixed in step 54 |
| 54 | mflux's complaint reads exception groups inside their frame, logging warnings in any case, the padding and cursor moves of a cleared nested bar, and skips the error of a traceback Python ignores at shutdown; the waiting piece is folded before it is bounded; the adapter's step uses the same tqdm pattern (`mfluxProgress.ts`); the signal case uses SIGKILL, which leaves no macOS crash report; the adapter has its two-piece case again; a case red without each rule, a redundant border rule removed | `pnpm test`, mutations | this commit |
| 55 | Review run 11 over step 54 | review record | open |
