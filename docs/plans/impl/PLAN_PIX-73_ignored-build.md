# PLAN PIX-73 — Deny the build script of unrs-resolver on purpose, so pnpm install ends without an error

Card: PIX-73 (setup), on the collection branch `feat/pix-7-skeleton-toolchain` after PIX-58; ordered by the
maintainer on sheet `collection-branch` (F1 = a, F4 = a) on 2026-10-13. Goal: `pnpm install --frozen-lockfile` ends
with exit 0, so CI on PR #2 reaches lint, format, types and tests.

## Acceptance

- [x] The maintainer decided: allow the build script of unrs-resolver, or ignore it on purpose — deny on purpose, sheet `collection-branch` F4 = a (2026-10-13 17:00 UTC); `pnpm-workspace.yaml` `allowBuilds: unrs-resolver: false`
- [x] `pnpm install --frozen-lockfile` ends with exit 0 on a fresh checkout — a fresh clone of f0cfe0f: `npx pnpm@12.9.1 install --frozen-lockfile` exit 0 (review run 1); a copy of the tracked files without `node_modules`, the same
- [x] Lint, which uses unrs-resolver through the import resolver, is green after the decision — `pnpm lint` exit 0 in that clone, and a boundary breach turns it red, so the resolver loads (review run 1); verify-full STAGE 2 GREEN

## Inventory

| Part | State | File |
| --- | --- | --- |
| Workspace packages list | exists | `pnpm-workspace.yaml` (`packages:` only) |
| pnpm's list of allowed and denied build scripts | new | `pnpm-workspace.yaml`, key `allowBuilds` |
| unrs-resolver 1.12.2 and its native bindings | exists | `pnpm-lock.yaml` (optional dependencies, linux-x64-gnu among them) |
| CI install step | exists, unchanged | `.github/workflows/ci.yml` (`pnpm install --frozen-lockfile`) |

## Placement

pnpm reads `allowBuilds` from `pnpm-workspace.yaml`. Measured with pnpm 12.9.1: `--allow-build '!unrs-resolver'`
writes exactly `allowBuilds: unrs-resolver: false` there. So the entry goes into the file pnpm itself writes it to,
next to the workspace's package list, and not into `package.json`.

## Behavior

`unrs-resolver`'s postinstall runs `napi-postinstall`'s `checkAndPreparePackage`, which checks that the native
binding is there and fetches it if not. The binding comes through the lockfile as an optional dependency, so denying
the script changes nothing at run time. pnpm then installs without running third-party code and without the error.
The binding must come from the lockfile: an install that skips optional dependencies would leave lint without it,
since the denied script was the fallback that fetched it.

## Test plan

- Measured before the plan, in a fresh clone in the scratchpad: without the entry, install exit 1
  (`ERR_PNPM_IGNORED_BUILDS`); with it, install exit 0 and `pnpm lint` exit 0.
- After the change: the same fresh clone of the branch, `npx pnpm@12.9.1 install --frozen-lockfile` and
  `pnpm lint`, both exit 0; `node scripts/verify-full.ts` green.
- After the push: CI on draft PR #2 runs by itself and reaches lint, format, types and tests.

## Order

| Step | What | Check | Status |
| --- | --- | --- | --- |
| 1 | `allowBuilds: unrs-resolver: false` in `pnpm-workspace.yaml`, tick all three lines | fresh clone: install exit 0, `pnpm lint` exit 0; verify-full green | f0cfe0f; review run 1 fixes in the commit that carries its record |

## Out of scope

- Other dependencies with build scripts: the install names only unrs-resolver as ignored (measured).
- CI itself: the workflow stays as it is; a push to the draft PR starts it.

## Open questions

None: the maintainer decided the only open point on sheet `collection-branch` F4.

## Changed on the way

- 2026-10-13, review run 1 (3 findings, all kept): the order's status names the commit, step 1 names all three
  ticks, lines 2 and 3 name the fresh clone the review measured, and Behavior says the binding must come from the
  lockfile.
