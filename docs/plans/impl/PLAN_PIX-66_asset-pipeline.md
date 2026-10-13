# PLAN PIX-66 — Bring the asset pipeline's motion chain into the repo under the hexagon

Card: PIX-66 (feature), a series with PIX-7, PIX-56 and PIX-57 on `feat/pix-7-skeleton-toolchain`; the pull request
comes once this card is built and tested (maintainer, 2026-10-13). Goal: the motion chain that made the PIX-65 base figures
runs as commands of `apps/asset-pipeline`, its decisions as tested core code, its tools behind adapters, and the base
figures reach `apps/office-ui/assets/` through it. The scratchpad scripts were the proof of concept; their backup
(named in the card's comment 14074, with `ASSEMBLY.md`) is the source this plan rewrites, never copies.

## Acceptance

- [ ] Each step of the motion chain (clip, frames, head track, export) runs as a command of `apps/asset-pipeline`, with its decisions in the core and its tools behind adapters
- [ ] Every core decision has unit tests with in-memory fakes, every adapter its own spec
- [x] The asset layout under `apps/office-ui/assets/` is decided with the maintainer as one PNG of the folder tree before the first asset lands — sheet `pix66-layout` F1 = yes (2026-10-13), PIX-66 comment 14084
- [ ] The base figures M and F with idle and walk reach `apps/office-ui/assets/` through the commands, and the maintainer compares them with the room page
- [ ] The skill `animate-figure` names the commands
- [ ] Every gate and verify-full is green, and an independent review checked the diff

## Inventory

Measured on 2026-10-13 (repo by `git ls-files`, `git grep` and reading; the proof of concept from its backup).

| Part | State | File |
| --- | --- | --- |
| Image render under the memory guard, render log, lock, status | exists | core `domain/Render/`, `port/outgoing/localRenderer.interface.ts`; infrastructure `adapter/Render/` |
| Memory reading and guard decision, lock | extend (shared by image and video) | infrastructure `adapter/Render/readMemory.ts`, `judgeMemory.ts`, `renderLock.ts` |
| Composition root, config by core schema, exit code table | extend | `apps/asset-pipeline/src/runPipeline.ts`, `renderConfig.ts`, `cli/renderExitCode.ts` |
| Figure, motion, clip and frame types | new | core `domain/Figure/` |
| Decisions of the motion chain: loop range, cycle by leg spread, unique poses with holds, drift line, frames used per motion, head-track verdict | new | core `domain/Figure/` (pure functions) and `application/service/` |
| Video clip under the guard (LTX-2.3 via `ltx-2-mlx`) | new | core port `videoRenderer.interface.ts`; infrastructure `adapter/Video/` |
| Frame measuring and cutting, edge clean-up of the light background | new | ports `frameMeasurer`, `frameCutter`; infrastructure `adapter/Frames/` with Python internals |
| Head tracking per frame | new | port `headTracker`; infrastructure `adapter/Frames/` with Python internals |
| Face parts scaled per motion with the head origin | new | core decision of the scale and offsets; adapter for the pixel resize |
| Asset store and figure manifest | new | port `assetStore`; infrastructure `adapter/Asset/`; manifest schema in `packages/protocol` |
| Python environment for adapter internals | new | `packages/infrastructure/python/` (`pyproject.toml`, `uv.lock`) |
| Parts by green key (Astra via the Codex CLI, key cut, despill, grey layer, main-color mark, trousers per shoe class, belts, hoods, hats, glasses, hair, face variants, in-place fixes) | not this card | PIX-70 |
| Skill `animate-figure` | extend | names the commands |
| Office drawing of a dressed figure (layer order, recolor, tucking) | not this card | the office cards (PIX-23 and on); kept described in `ASSEMBLY.md` |

## Placement

By the core rule: what touches files, processes or a model is an adapter; what decides without touching them is
domain or application; the app wires; the manifest crosses to the office and lives in `packages/protocol`.

- **The cut between TypeScript and Python.** ADR 0019 admits Python only as an adapter's internals, started as a
  process and tested through that adapter's spec. Pixel work (flood fill, area downscale, template match, keying)
  stays in Python. Every rule that picks something stays in the core: Python measures and reports numbers as JSON,
  the core decides on them, Python applies the decision. Example: the frame cutter reports the leg spread and head
  centre per video frame, the core picks the cycle, the unique poses and their holds and the drift line, the cutter
  crops, grounds and scales.
- **Thresholds are values, not code.** Every threshold of the proof of concept (`ASSEMBLY.md`, the inventory of the
  scripts) becomes a named value in a core schema with its default, so a test can pin it and a later change is one
  line.
- **One guard for every local model.** The image and the video render share the memory guard and the lock; the guard
  moves to a shared adapter module, and both adapters use it. One render at a time stays true across both.
- **Machine paths come from config.** The `ltx-2-mlx` checkout, the model snapshot and the Python runner are parsed by
  a core config schema at start, like the image render's.

## Behavior

Commands (names final in the step that builds them):

- `pnpm assets clip <figure> <motion>` renders one clip from the figure's still under the guard, in `loop` or `cycle`
  mode with the prompt file of the motion; progress streams like the image render's.
- `pnpm assets frames <figure> <motion>` cuts the clip into sprite frames: a loop between its anchors, a cycle by the
  leg spread with each unique pose and its hold; the light background is taken off the edges.
- `pnpm assets track <figure> <motion>` finds the head origin per frame and checks it against the ear (at most 1 px).
- `pnpm assets export <figure>` writes the frames, the face parts at the motion's scale and the manifest into
  `apps/office-ui/assets/` in the agreed layout.

**Asset layout** (agreed on sheet `pix66-layout`, 2026-10-13): `apps/office-ui/assets/figures/` holds a generated
`manifest.json` (per figure and motion the frame order, holds, scale, head origin per frame, face part offsets) and per
figure `m/` and `f/` the folders `body/<motion>/NN.png` and `face/<motion>/<part>.png` (`blank`, `brows`, `eyes`,
`eyes-half`, `eyes-closed`, `nose`, `mouth`) at that motion's scale. Front-right is mirrored at draw time, not stored.
`parts/` is kept for PIX-70; rooms and furniture beside `figures/` come with PIX-25. Names are lowercase with hyphens,
frames numbered with two digits from 00.

## Test plan

- Core: every decision with unit tests on numbers, every service with `InMemory<Port>` fakes; the cycle choice and
  the unique poses are pinned against the measured values of the proof-of-concept clips (`cycle.json` of M and F).
- Adapters: specs with injected process and file system fakes for every failure key; the Python internals run in an
  integration spec on synthetic frames that the Python itself draws into a temp folder (no image is committed outside
  the asset folder, the image gate refuses it).
- End to end: the commands run on the backed-up clips of M and F; the resulting frames are compared pixel by pixel with
  the frames the room page shows (version 55); the maintainer compares the office assets with the room page.

## Out of scope

- Drawing a dressed figure in the office: the office cards; `office-ui` may import only the protocol, so the runtime
  rules need their own design there.
- New gestures: PIX-58, made through these commands afterwards.
- The parts by green key (wardrobe, hair, face variants, accessories): PIX-70, split off by the maintainer.

## Changed on the way

- 2026-10-13, decided by the maintainer: the card joins the series on `feat/pix-7-skeleton-toolchain`; no pull request
  before something is properly implemented and tested in the hexagon. The finished figure assets (about 15 MB of PNG,
  each under 256 KB) may enter the public history, without Git LFS.
- 2026-10-13, decided by the maintainer: the clock port and its adapter go. The core never used them; only the image
  adapter read its log time through them while reading `Date.now()` itself elsewhere. An adapter reads the time
  directly; the core rule (no clock in the core) stays, and a port comes once the core needs time.
- 2026-10-13, step 5: the export use case moves to step 10, where the manifest it fills is defined.
- 2026-10-13, step 4: the core decides the sprites, holds, shifts, margin and height; the cutter measures the
  shifted frames and applies them, so the crop is measured on the shifted masks as in the proof of concept. The F walk
  keeps its cycle bounds 29 to 56 as a value: the automatic rule (third-last to last spread maximum) gives 29 to 68
  there, two strides; M's rule gives its shipped 13 to 40.
- 2026-10-13, sheet `pix66-plan`: the maintainer approved this plan (F1 = yes) and split the parts by green key into
  PIX-70 (F2 = a); the card's first and fifth acceptance lines narrowed to the motion chain and `animate-figure`.

## Open questions

- **Decided by the maintainer:** the approval of this plan and the split of the parts into PIX-70 (sheet
  `pix66-plan`, F1 and F2).
- **Decided by the maintainer:** the asset layout (sheet `pix66-layout`, F1).
- **I decide:** the TypeScript/Python cut above, the shared guard, the Python environment (uv 0.12.12 with
  Python 3.10, OpenCV 4.14.0, NumPy 2.2.6, Pillow 12.3.0, the versions the proof of concept ran with, measured
  2026-10-13), because they follow from ADR 0019 and the core rule.

## Order

| Step | What | Check | Status |
| --- | --- | --- | --- |
| 1 | The asset layout under `apps/office-ui/assets/` as one PNG of the folder tree | the maintainer's yes on the card | sheet `pix66-layout` F1 = yes, PIX-66 comment 14084 |
| 2 | Python environment for adapter internals: `pyproject.toml` and lock, a runner the adapters call | `uv run` imports the measured versions; check-english and the image gate green | 774ff31 |
| 3 | Core `domain/Figure/`: figure, motion, clip mode, clip job, frame measures, frame plan, head track as schemas and enums | core specs | 5ce1f65 |
| 4 | Core decisions of the motion chain: loop range, cycle by leg spread, unique poses with holds, drift line, frames used | specs pinned on the proof-of-concept `cycle.json` | 3fdab47 |
| 5 | Core ports and services: clip, frames, track; the figure exception and its keys | service specs with in-memory fakes | this commit |
| 6 | Shared memory guard and lock for image and video | the existing render specs stay green, the guard's own spec | open |
| 7 | Video adapter (LTX-2.3 via `ltx-2-mlx`) under the guard, with its config | adapter spec with process and file fakes | open |
| 8 | Frame measurer and cutter with the edge clean-up, Python internals | adapter spec; integration spec on synthetic frames | open |
| 9 | Head tracker, Python internals | adapter spec; integration spec on synthetic frames | open |
| 10 | Figure manifest schema in `packages/protocol`, the export use case and the file asset store | protocol, service and adapter specs; the 256 KB limit | open |
| 11 | Commands `clip`, `frames`, `track`, `export` with config and exit code table | handler and composition root specs | open |
| 12 | Base figures M and F with idle and walk through the commands into `apps/office-ui/assets/` | pixel comparison with the room page frames; the maintainer's comparison | open |
| 13 | The skill `animate-figure` names the commands; the skills register regenerated | check-skills | open |
| 14 | Full gate and independent review | verify-full; review record | open |
