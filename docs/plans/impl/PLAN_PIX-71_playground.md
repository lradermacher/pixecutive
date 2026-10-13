# PLAN PIX-71 — Office UI playground: load the base figures from the manifest and play every motion

Card: PIX-71 (feature), a series with PIX-7, PIX-56, PIX-57 and PIX-66 on `feat/pix-7-skeleton-toolchain`, after
PIX-66; ordered by the maintainer on 2026-10-13. Goal: one page in `apps/office-ui` where every motion the asset
pipeline exports is looked at, so new motions (PIX-58 and on) are judged in the office's own code and not in a
scratchpad page.

## Acceptance

- [x] `pnpm playground` serves a page from `apps/office-ui` that loads the figure manifest and refuses one the protocol schema refuses, saying why — root `package.json` script `playground`; `src/playground/readManifest.ts`, `page.ts`; in Chromium a refused manifest shows "No stage: version: …" (review runs 1 and 2)
- [x] Every figure and motion of the manifest plays at 24 ticks per second with its holds, the face parts placed by the head origin per frame — `frameAt.ts`, `playground.ts`, `facePlaced.ts`, `drawFigure.ts` with their specs; review run 1 measured 48 frame changes in 2 s at hold 1
- [x] Front-left and front-right (mirrored) can be switched, and the zoom keeps the pixels crisp — `tileTransform.ts`, `controlGroups.ts`; review run 1: mirrored tiles equal the flipped ones with 0 differing bytes, every 2×2 and 4×4 block uniform
- [x] The page imports only the protocol, and its logic (frame timing, face placement, mirroring) has unit tests — lint zones refuse a core import (probed in review run 1); 9 spec files, 35 tests in `apps/office-ui`
- [x] The maintainer approved the page from one PNG before it was built — sheet `pix71-plan` F1 = yes (2026-10-13 01:24 UTC), PIX-71 comment 14088
- [x] Every gate and verify-full is green, and an independent review checked the diff — verify-full STAGE 2 GREEN; review runs 1 (c6409f0, 4 findings, fixed in 49353db) and 2 (49353db, 2 notes)

## Inventory

| Part | State | File |
| --- | --- | --- |
| Figure manifest schema and face parts | exists | `packages/protocol/src/figureManifest.schema.ts`, `facePart.enum.ts` (PIX-66) |
| Figure assets and manifest | exists after PIX-66 step 12 | `apps/office-ui/assets/figures/` |
| Office UI package | extend | `apps/office-ui` (only `packageName` today) |
| Vite | exists | root `package.json` (8.3.2), used for the asset pipeline's build |
| Frame timing, face placement, mirroring | new | `apps/office-ui/src/playground/` |
| The page and its serving script | new | `apps/office-ui/playground.html`, root script `playground` |

## Placement

`office-ui` may import only the protocol (core rule, lint zones); its logic lives in the app and is tested there. The
drawing is plain Canvas 2D, so the renderer spikes PIX-13 and PIX-14 stay open. Pure logic (which frame shows at a
tick, where a face part goes, the mirrored x) is split from the canvas calls so it can be tested without a browser.

## Behavior

The page loads `assets/figures/manifest.json`, parses it with `figureManifestSchema` and shows the reason when the
parse fails. It draws every figure side by side on the light floor color, plays the chosen motion at 24 ticks per
second, holding each frame for its `hold`, draws the blank head and the face parts at the frame's head origin
(eyes open), mirrors the whole figure for front-right, and scales by whole numbers without smoothing. A step button
pauses and advances one frame; the frame and hold are shown.

## Test plan

- Unit tests: the frame at a tick over holds and the wrap at the end; the face part's place from origin and offset;
  the mirrored position; a manifest the schema refuses yields its reason.
- The page in a browser (Playwright, the page's own code) for M and F, idle and walk, both facings, compared with
  the approved PNG.

## Out of scope

- Recoloring, clothes, hair and accessories: the office cards and PIX-70.
- The real office renderer: the spikes PIX-13 and PIX-14 decide it.

## Changed on the way

- 2026-10-13, step 3: the browser has no DOM in the unit tests and no test library is added for it; the page takes
  the window it runs in, so its spec drives it with a small fake window, and the controls are data
  (`controlGroups.ts`) tested without a page. A manifest that cannot be loaded at all says so, not as a refusal.
  Checked in Chromium through `pnpm playground`: M and F, idle and walk, both facings, 1×, 2× and 4×, the step, and
  a refused manifest showing its reason; no script error.
- 2026-10-13, review run 1: a manifest the server does not serve names its HTTP status ("answered 404"), and an image
  the server lacks is listed above the stage ("Not served, left out: …") instead of being left out silently. Whether
  a motion's sprites carry a face is not in the manifest; the playground decides it by the name `idle`, and PIX-58
  settles it for its gestures.

- 2026-10-13, before the build, from the approved PNG and the room page's draw code (`drawFace`, `idleFrame`,
  `drawFigure` of the proof of concept): the motion choice has "all" as its default, which shows every figure in every
  motion side by side as the PNG does. A figure is assembled at sprite size, the face parts scaled smoothly because
  their boxes have fractional sizes, and only then zoomed without smoothing. The blank head is drawn for idle only:
  the idle sprites keep the face of their still, the walk sprites have a blank face. The manifest names no playback,
  and the room page played idle back and forth, which hides a jump at a loop's ends: a switch "loop / back and forth"
  for the motions on the spot (advance 0) is a viewing control of the page, default back and forth; a walk always
  loops.

## Open questions

- **The maintainer decides:** this plan and the page from its PNG (sheet `pix71-plan`).

## Order

| Step | What | Check | Status |
| --- | --- | --- | --- |
| 1 | The page's PNG approved | the maintainer's yes on the card | sheet `pix71-plan` F1 = yes, PIX-71 comment 14088 |
| 2 | Logic: frame at a tick, face placement, mirroring, manifest loading | unit tests | 70c27f5 |
| 3 | The page with Canvas 2D and the controls, served by `pnpm playground` | the page in a browser, both figures and motions | d109f1c, 6a6a795 |
| 4 | Full gate and independent review | verify-full; review record | review records c6409f0, 49353db; fixes 49353db |
