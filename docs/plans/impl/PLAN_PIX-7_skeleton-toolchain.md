# PLAN_PIX-7 — hexagon skeleton, code-quality toolchain and CI

Card PIX-7 (epic PIX-1). Branch `feat/pix-7-skeleton-toolchain` from `main` at 4b091a9; one pull request.

Goal: the six workspace packages of ADR 0011 and the asset pipeline app exist, and every line of product code written after this card is held by
lint, import zones, the architecture guard, tests and CI, each proven by a probe that turns it red.

## Decisions this plan builds on

- ADR 0011: `packages/core`, `packages/infrastructure`, `packages/protocol`, `apps/company-server`, `apps/companion`, `apps/office-ui`;
  the core holds `domain/`, `application/service/`, `application/exception/`, `port/outgoing/`.
- ADR 0006 (typing and import zones), ADR 0007 (tooling), ADR 0008 (testing and gates).
- Tool-evaluation sheet of 2026-10-04: F1 ESLint on TypeScript 6 beside TypeScript 7, F2 eslint-plugin-boundaries,
  F3 every planned rule, B1 Prettier, Vitest, GitHub Actions, gitleaks, zod, tsdown.
- Maintainer, 2026-10-04: the hexagonal structure first, so that the asset generator cannot break out of the
  architecture later; it is the first step of this card, and every gate is proven on it before the card ends.
- Placement of the asset pipeline by the core rule's criteria: what an asset is (kind, footprint in tiles, anchor,
  directions, animations, layers, color slots) decides without touching the outside, so it is domain in the core;
  driving a generation tool touches the outside, so it is an adapter in infrastructure; the manifest crosses to the
  browser, so it is protocol; the command wires them, so it is an app. A new ADR 0019 adds `asset-pipeline` without
  replacing anything.
- App names, sheet app-names of 2026-10-04 (maintainer: option A): `apps/company-server`, `apps/companion`,
  `apps/office-ui` instead of the names in ADR 0011; ADR 0020 supersedes ADR 0011 points 3 and 4 and the app names in
  ADR 0004 and 0012. The rename lands after step 3, before lint builds on the names.
- Decided on the way, from review runs 1 and 2 (each traced to the ADR that settles it):
  - Every mechanism covers `.ts`, `.tsx`, `.mts` and `.cts`; the office UI is a browser app and may use JSX.
  - Inside the core, the domain may import the core exceptions, because a domain rule fails with a key (ADR 0011
    point 7); the infrastructure may import the protocol, because an outgoing adapter to another part of Pixecutive
    sends its messages. Both stand in ADR 0018 point 1, which therefore also supersedes the zone mechanism and the zone
    directions of ADR 0011's Confirmation and Mechanics.
  - Only JavaScript's built-in error classes are forbidden in a core `throw`; a core exception may end in `Error`.
  - `check-tests` asks for a spec only where the syntax tree holds logic (a function, class, accessor, branch, loop,
    `?:`, `&&`, `||` or `??`); types, constants, enums and re-exports need none, so no spec is written only for the
    gate. Without a main ref to compare against it is red.
  - The pre-commit copy rebuilds each package's `node_modules`: workspace links point into the copy, so the staged
    state of another package is read; a link that points nowhere stops the commit and names `pnpm install`.
  - The architecture guard judges the `src` folders, finds imports at a line start or after a semicolon, and rejects a
    relative path that leaves its package.

## Acceptance

Taken verbatim from the card.

- [x] The skeleton of ADR 0011 exists: `packages/core`, `packages/infrastructure`, `packages/protocol`, `apps/company-server`, `apps/companion`, `apps/office-ui`, each a workspace package with `package.json`, `tsconfig`, an entry and one test
- [x] `packages/core` holds the folders of ADR 0011 point 1 (`domain/`, `application/service/`, `application/exception/`, `port/outgoing/`)
- [x] `apps/asset-pipeline` is a seventh workspace package, placed by a new ADR that makes the asset pipeline an app of the hexagon (asset model in the core, generation tools behind adapters in infrastructure, manifest in protocol), under the same import zones
- [x] Root scripts `lint`, `format`, `format:check`, `typecheck`, `test`, each green on the skeleton
- [x] ESLint with no `any`, explicit return and boundary types, no non-null assertion, enum over string union, `--max-warnings 0`
- [x] Import zones for `@pixecutive/*` that also catch `import()` and `require()`: core imports no framework, no infrastructure, no app and no IO; `apps/office-ui` never imports the core; a planted forbidden import fails, with a probe
- [x] `architecture-guard` runs on every write and rejects a forbidden import before it is saved, with a probe
- [x] A gate that enforces a test per changed unit (Vitest `--changed` alone does not, measured), with a probe
- [x] CI runs secret scan, lint, typecheck and tests on every pull request, forks included
- [x] Every `Planned PIX-7` bracket in rules and ADRs names its built mechanism

## Versions, measured 2026-10-04 with `npm view` and the GitHub releases API

| Tool | Version | Note |
| --- | --- | --- |
| eslint | 10.12.0 | flat config |
| @eslint/js | 10.0.1 | |
| typescript-eslint | 8.71.0 | peer `typescript >=4.8.4 <6.1.0` |
| typescript (for lint) | `npm:@typescript/typescript6@6.0.2` | measured: `require("typescript")` answers 6.0.x |
| @typescript/native (for `tsc`) | `npm:typescript@7.0.2` | measured: `node_modules/.bin/tsc` is 7.0.2 beside `tsc6` |
| eslint-plugin-boundaries | 7.2.0 | peer `eslint >=6`, Node ≥ 18.18 |
| @eslint-community/eslint-plugin-eslint-comments | 4.8.1 | `require-description` for ADR 0005 point 11 |
| prettier | 3.9.9 | |
| eslint-config-prettier | 10.1.8 | |
| vitest, @vitest/coverage-v8 | 5.0.3 | |
| zod | 4.6.5 | `packages/protocol`, and `packages/core` since ADR 0021 |
| tsdown | 0.23.0 | `apps/companion` build, wired with the first client story |
| gitleaks | v8.30.1 | pinned binary with checksum in CI |
| actions/checkout, pnpm/action-setup, actions/setup-node | v7.0.1, v6.1.0, v7.0.0 | pinned by commit SHA |

Every version is measured again on the day it is installed and pinned exactly.

## Inventory

| Part | State | File |
| --- | --- | --- |
| Workspace root, `typecheck` over scripts and hooks | exists, extend | `package.json`, `tsconfig.json` |
| Workspace globs `apps/*`, `packages/*` | exists | `pnpm-workspace.yaml` |
| Six packages | new | `packages/{core,infrastructure,protocol}/`, `apps/{company-server,companion,office-ui}/` (ADR 0020) |
| Asset pipeline app and its ADR | new | `apps/asset-pipeline/`, `docs/ADR/0019-*.md` (asset model in the core, generation tools behind adapters in infrastructure, manifest in protocol; their code is PIX-66) |
| Shared compiler options for product code | new | `tsconfig.base.json` (product code may use `enum`, so no `erasableSyntaxOnly`; tooling keeps it in `tsconfig.json`) |
| Comment, English, one-export gates and `quality-guard` | exists | `scripts/check-*.ts`, `.claude/hooks/quality-guard.ts` |
| ESLint flat config | new | `eslint.config.ts` |
| Import zones | new | in `eslint.config.ts` via eslint-plugin-boundaries |
| `architecture-guard` | new | `.claude/hooks/architecture-guard.ts`, wired in `.claude/settings.json` |
| Gate test per changed unit | new | `scripts/check-tests.ts` |
| Prettier, editor settings | new | `.prettierrc.json`, `.prettierignore`, `.editorconfig` |
| Vitest projects | new | `vitest.config.ts` |
| CI | new | `.github/workflows/ci.yml` |
| Gate registry and full verify | exists, extend | `.claude/data/precommit-checks.tsv`, `scripts/verify-full.ts` |
| Import-zone mechanism in ADR 0006 point 8 (`no-restricted-imports`) | exists, superseded | new ADR 0018 names eslint-plugin-boundaries (F2); ADR 0006 gets the partial supersession |
| `Planned PIX-7` brackets | exists, extend | `.claude/rules/core.md`, ADR 0004–0008, 0011, 0012 |

## Placement

- Packages: by ADR 0011 point 1 to 4 and, for `apps/asset-pipeline`, ADR 0019 (the core decides, infrastructure touches the outside, protocol crosses the
  wire, apps wire and drive; `apps/office-ui` stands outside the hexagon).
- Lint, format and test configuration: the workspace root, because one configuration holds every package.
- `architecture-guard`: a hook, because it must reject a forbidden import before the file is saved (ADR 0006 point 9).
- `check-tests`: a gate in `scripts/`, registered in `precommit-checks.tsv` like every other gate (ADR 0008).

## Test plan

- Each package has one spec that imports its entry and passes; `pnpm test` runs all six through Vitest projects.
- Lint: a probe plants, in a throwaway copy, `any`, a missing return type, a non-null assertion, a string-literal
  union, `new Date()` and `throw new Error` in the core, and an `eslint-disable` without reason: each red, the clean
  skeleton green.
- Import zones: a probe plants core → infrastructure, core → `node:fs`, core → a framework, core → an app,
  `apps/office-ui` → core, core → `node:child_process` (what a model call needs), each as static `import`, `import()`
  and `require()`: each red; infrastructure → core and `apps/asset-pipeline` → infrastructure green.
- `architecture-guard`: a probe feeds a PreToolUse write of a forbidden import (red) and of an allowed one (green).
- `check-tests`: a probe changes a source file without its spec (red), with its spec (green), and a spec only (green).
- CI: the workflow runs on the pull request of this card; its jobs are read from the run, not assumed.

## Out of scope, with reasons

- **Feature code in any package:** the skeleton holds only entries and one test each; the stories of M1 to M5 bring
  the code; the asset model, the generation adapters and the manifest are PIX-66.
- **NestJS, TypeORM, the renderer and tsdown wiring:** they arrive with the first story that needs them; installing
  them now would be code without a user.
- **GitHub branch protection and squash-only merges:** PIX-9.
- **Coverage thresholds:** ADR 0008 decides tests per changed unit, not a percentage.
- **Lint over the tooling code:** measured in step 4, 54 findings in 27 of 79 tooling files, most of them complexity in
  the guards that nine review runs just checked; they are refactored with their probes in PIX-54, while the tooling
  stays under `tsc --strict` and the comment, English and one-export gates.
- **ESLint loads its TypeScript config through jiti 2.7.0:** ESLint 10.12 offers native loading only behind the flag
  `unstable_native_nodejs_ts_config` (measured in `lib/shared/flags.js`); the gate chain does not rest on an unstable
  flag.

## Changed on the way

- 2026-10-12 (PIX-57): acceptance line 3 says "generation tools behind adapters" instead of "Blender adapter",
  because ADR 0019 was rewritten in place for the proven asset flow; the asset model's code moved from PIX-25 to
  PIX-66; zod is also in the core (ADR 0021); the unused `globals` was removed. Card and plan carry the same text.

## Open questions

None that blocks the build. The superseding ADR 0018 is the record of the maintainer's answer F2 on the
tool-evaluation sheet, not a new decision.

## Steps

| Step | What | Check | Status |
| --- | --- | --- | --- |
| 1 | Skeleton: seven packages (ADR 0011, and `apps/asset-pipeline` with ADR 0019) with `package.json`, `tsconfig` from `tsconfig.base.json`, `src/index.ts`, the core folders, workspace links | `pnpm install && pnpm typecheck` | 60abcbd |
| 2 | Vitest projects and one spec per package; root `test` | `pnpm test` | 9fade8c |
| 3 | Prettier and `.editorconfig`; root `format`, `format:check` | `pnpm format:check` | d465d35 |
| 4 | ESLint flat config with the rules of ADR 0005, 0006 and the core rule, lint on TypeScript 6; its probe | `bash scripts/probe-lint.sh && pnpm lint` | 347bac6 |
| 5 | Import zones with eslint-plugin-boundaries; ADR 0018; their probe | `bash scripts/probe-lint.sh && node scripts/check-docs.ts --all` | cea3e86 |
| 6 | `architecture-guard` with its probe, then wired | `bash scripts/probe-hooks.sh && node scripts/check-settings.ts` | 9afdddf |
| 7 | `check-tests` with its probe, then registered | `bash scripts/probe-tests.sh && node scripts/check-carriers.ts --all` | f1f2001 |
| 8 | Gates into `precommit-checks.tsv` and `verify-full` | `node scripts/verify-full.ts` | no own commit: each gate entered pre-commit with its step; verify-full stage 2 green and all 23 probes green on f1f2001 |
| 9 | CI workflow with pinned actions and gitleaks | the workflow's own run on this card's pull request | 1dbaaf5 (its first run is on the pull request of this card) |
| 10 | Every `Planned PIX-7` bracket names its mechanism | `node scripts/check-carriers.ts --all && grep -rn 'Planned PIX-7' .claude/rules docs/ADR` (empty) | 7370e21 |
