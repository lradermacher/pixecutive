# PLAN PIX-78 — Bring the head parts by green key into the asset pipeline: hair, beards, hats, glasses and face variants as commands

Card: PIX-78 (feature), on the collection branch `feat/pix-7-skeleton-toolchain` (ADR 0024), before PIX-70; split
from PIX-70 by the maintainer on sheet `pix70-cut` (F1 = a, F2 = a) on 2026-10-13. Goal: every head part of M and F
is made, cut and placed by `pnpm assets` commands and follows every gesture by the per-frame head origin, with the
Astra adapter and the key cut built so that PIX-70 reuses them for the body parts.

## Acceptance

- [ ] Each step of the head-parts chain (green head templates, hair and beards, hats with hide masks, glasses, hair under hats with its lift, face-part variants) runs as a command of `apps/asset-pipeline`, with its decisions in the core and its tools behind adapters
- [ ] Every core decision has unit tests with in-memory fakes, every adapter its own spec
- [ ] One hairstyle, one hat and one pair of glasses made through the commands match their proof-of-concept layers, compared zoomed through the page's draw functions
- [ ] The hair, beards, hats, glasses and face variants of M and F reach `apps/office-ui/assets/` and the manifest through the commands
- [ ] Every head part follows each gesture (idle, walk, wave, sit, type) by the per-frame head origin, checked in the playground
- [ ] The skill `figure-part` names the commands
- [ ] Every gate and verify-full is green, and an independent review checked the diff

## Inventory

Measured on 2026-10-13 in the repo (git grep) and in the PIX-65 backup named in PIX-66 comment 14074 (BK below).

| Part | State | File |
| --- | --- | --- |
| Face parts: enum, spec, source, placement | extend: one image per part, no kinds with variants | `packages/core/src/domain/Figure/facePart.enum.ts`, `figuresSpec.schema.ts:46`, `faceSource.interface.ts`, `motionAsset.interface.ts` |
| Face cut and scaling (`assets.py face`: crop alpha>3, margin 2/3, premultiplied area resize) | exists, reused unchanged: it equals the backup's `scaled()` | `packages/infrastructure/src/adapter/Asset/assets.py:50-72`, `assetStore-files.adapter.ts:127-157` |
| Export of a motion with head scale and origin per frame | extend: head parts beside the face parts | `packages/core/src/application/service/exportMotion.service.ts`, `apps/asset-pipeline/src/cli/exportMotion.handler.ts:20-25` |
| Manifest | extend: head layers with variants, hide, lift and order | `packages/protocol/src/figureManifest.schema.ts:31` |
| Playground | extend: head layers, variant pickers, `destination-out` for the hide, the lift of a hat | `apps/office-ui/src/playground/facePlaced.ts:19`, `drawFigure.ts`, `controlGroups.ts` |
| Figure sources (`open`, `blank2`, `blank2_mask`) | exists, byte-identical to BK | `renders/figures/<n>/` (local renders folder) |
| Green still and green open still | new as sources: the BK green still and green open still; no producer in BK | `apps/asset-pipeline/data/figures/<n>/` |
| Head and tall grids | new command; derivable from the green still exactly (9 or 6 tiles, error 0) | BK head and tall grids, the inverse of its grid split |
| Astra call (Codex CLI `exec -i <png> -o <msg>`, the image saved by the model, retries on reconnect, quota lines) | new adapter | BK shell scripts for hair, hats, glasses, hair under hats and face grids |
| Grid split into stills | new | BK grid split scripts |
| Key cut of hair, beards, hair under hats | new | BK green cut script (alignment, separation from the green, spill removal, soft ring) |
| Cut of hats with hide masks and of glasses | new | BK hat and accessory cut scripts |
| Hair under a hat: input with the beanie as a magenta shape | new | BK hair-under-hat input script |
| Face variants: cut to the nearest default part | new | BK variant cut and alignment scripts |
| Skull top and lift per hair | new; rule measured: `lift = skullTop − first row with alpha > 3`, matches all 27 M and 48 F entries; skull top = first row of `open` whose summed difference to the background exceeds 60 (m 107, f 108) | BK `<n>_face.json`, no writer |
| M → F warp of glasses and hats | new command option, offsets as data (glasses 0.98, −20.5, −10.5; hats 0.92, −11, −4.5) | BK warp script |
| Prompts and variant lists | new as data | BK script headers and the logs of the face grids |
| Rule and skill | extend | `.claude/rules/assets.md`, `.claude/skills/figure-part/SKILL.md` (names no commands, `data: []`) |

## Placement

By the core rule's criteria:
- What decides without touching the outside goes into the core: head kinds and variant ids, the order of the head
  layers, which hats hide hair and which are open on top, the lift and its clamp, the thresholds of every cut as named
  values in a config schema, the grid layouts, and the M → F offsets.
- What touches files, processes or pixels goes behind ports into adapters:
  - The Codex CLI is a process: `IImageEditor`, adapter `imageEditor-codex.adapter.ts`.
  - The grid split, the three cuts and the measures run in OpenCV as Python internals of one adapter:
    `IPartCutter`, adapter `partCutter-opencv.adapter.ts` with `Parts/parts.py`. This follows the Frames adapter of
    PIX-66, with Python as adapter internals (ADR 0019).
- The commands and their data go into the app. The manifest with head layers goes into the protocol.

The cut adapter and the image editor are the shared chain that PIX-70 reuses: key cut, despill and soft ring are
named by kind, not by head.

## Behavior

The commands, under the memory guard where a model runs, with each result checked by eye before it is built on:

- `pnpm assets grid <figure> <layout>`: the head (3×3) or tall (3×2) grid from the green still, the inverse of the
  split.
- `pnpm assets draw <figure> <kind> <set>`: one Astra call per grid, with the prompt from data. The kinds are hair,
  beard, hat, band, glasses, hair under hat and face variant.
  - It retries on a reconnect and stops on a quota line, naming it.
  - The image lands in the renders folder and is resized to the grid's size.
- `pnpm assets split <figure> <layout> <render>`: grid cells into stills at the cut size.
- `pnpm assets cut <figure> <kind> <id>`: the key cut of the kind.
  - Hair, beards and hair under hats are aligned to the figure's lines, separated from the green, freed of spill and
    soft at the ring.
  - A hat also writes its hide mask.
  - Glasses keep their lenses.
  - A face variant goes to the nearest default part.
  - The output is a still-sized layer, and for hair also its lift.
- `pnpm assets hair-under-hat <figure> <id>`: the input with the beanie as a magenta shape, then draw and cut as
  above.
- `pnpm assets export <figure> <motion>`: extended so the manifest carries each head layer per variant.
  - Each layer gets its placement at the head scale.
  - A hat also carries its hide, and hair also its lift; the figure carries its skull top.
  - The layer order is the order of the proof of concept: blank, brows, eyes, nose, mouth, beard, hide, hair or hair
    under hat, glasses, hat.
- The playground draws them by the per-frame head origin:
  - The figure goes on its own canvas, the hide cuts it (`destination-out`), and a hat rises by the lift of the hair
    under it, unless the hat is open on top or a hair-under-hat exists.
  - Pickers choose hair, beard, hat and glasses per figure.

The existing renders of the backup are the input of the import. The cut, split and export commands turn them into the
shipped layers, so the 3,790 body files stay with PIX-70, and only the head renders are copied into the local renders
folder, which is not in git.

## Test plan

- **Core:** unit tests with in-memory fakes for every decision:
  - kinds and ids, the order, the lift and its clamp, the hide rule for open hats;
  - grid layouts, the M → F offsets, the schemas refusing bad data;
  - the services of draw, cut and export, with the ports faked.
- **Adapters:** one spec each.
  - The image editor runs against a stub `codex` script: it finds the saved image, resizes it, retries a reconnect and
    names a quota line.
  - The cutter runs on small synthetic scenes: a green field with a drawn shape, spill and a ring; a hat over a head
    for the hide mask; a lens inside a frame.
  - The protocol spec covers the extended manifest.
- **Against the proof of concept (line 3):** run on the backup's own Astra renders.
  - `cut` makes one hairstyle (m hair 1), one hat (m hat 4 with its hide) and one pair of glasses (m glasses 1).
  - Each is compared with its backup layer: pixel difference and alpha difference, then zoomed side by side through
    the playground's draw functions on light, medium and dark.
  - One fresh `draw` per kind is shown beside them for the eye, since a new drawing never equals the old one by pixel.
- **Lift and skull top:** computed for all M and F hair and compared with the backup's face JSON (75 of 75 equal).
- **Playground:** every head part of M and F on idle, walk, wave, sit and type, front-left and front-right, zoomed,
  through the page's own code.

## Order

| Step | What | Check | Status |
| --- | --- | --- | --- |
| 1 | Core: head kinds, variant ids, layer order, hide and open-top rule, lift with clamp, grid layouts, M → F offsets, cut thresholds as a config schema | core unit tests green | a6ef273 |
| 2 | Protocol: manifest head layers with variants, hide, lift, skull top and order | protocol spec green, old manifest still parses | 9921684 |
| 3 | Port and adapter `IImageEditor` / `imageEditor-codex.adapter.ts`, the binary path from the local config | adapter spec against a stub `codex` green | open |
| 4 | Port and adapter `IPartCutter` / `partCutter-opencv.adapter.ts` with `Parts/parts.py`: grid, split, key cut, hat cut with hide, glasses cut, face-variant cut, skull top and first row | adapter spec on synthetic scenes green | open |
| 5 | Services and commands `grid`, `draw`, `split`, `cut`, `hair-under-hat`, and the data: prompts, variant lists, green sources | handler specs green; `pnpm assets grid m head` equals BK `m_green_head.png` | open |
| 6 | Line 3: cut m hair 1, m hat 4, m glasses 1 from the backup's renders and compare; one fresh draw per kind | pixel and alpha difference reported; zoomed PNG to the maintainer | open |
| 7 | Export extended; import every head part of M and F from the backup's renders through split and cut | lift 75/75 equal to BK; manifest parses; assets folder holds every head part | open |
| 8 | Playground: head layers, pickers, hide by `destination-out`, hat lift | playground specs green; every head part on all five motions, both facings, zoomed, checked in the browser | open |
| 9 | Skill `figure-part` names the commands, the assets rule if a line changes | check-skills, check-rules green | open |
| 10 | verify-full, the boxes, the review | verify-full green, `ticket.ts boxes` with no open box, review record on the head | open |

## Out of scope

- **Body parts and the shared chain's body steps:** garments, shoes, belts, hoods, laces and logos go to PIX-70, and
  garments on wave, sit and type go to PIX-79.
- **Recoloring hair at runtime and the office's real renderer:** they belong to the office cards. Hair ships as drawn.
- **The trim of a hat over hair without a hair-under-hat** (`underHat()` in the backup's page): it is runtime pixel
  work of the office renderer.
- **Expressions:** they belong to PIX-74.

## Open questions

- **The green still and the green open still come in as sources, not rebuilt.** Decided by the maintainer on sheet
  `pix78-plan` F2 = a (2026-10-13), deviating from sheet `pix70-cut` B1.
  - The backup has no producer for them.
  - A rule rebuild (skin hue on `open`) reaches IoU 0.94 for M and 0.93 for F. It misses the dark body lines and
    takes in some shading, so every cut built on it would shift.
  - They are our own files, derived from our approved still. The grids are rebuilt exactly from them (step 5).
- **Which F glasses and hats were warped from M is not recorded.** Decided, not asked: F's backup layers ship as
  F's own, and the warp stays a command option for new ones.

## Changed on the way

- 2026-10-13, step 3:
  - The Codex CLI is found as the newest ChatGPT extension of VS Code (`codexBinary`). The app may name another one
    through its environment. The local config holds no machine paths so far, and the extension updates itself.
  - The drawing is not resized when it arrives: every cut resizes its input to the template first, as the proof of
    concept did, so the editor only checks that the drawing is there.
  - Two keys are new: `figure.draw_failed` and `figure.draw_quota`, with exit codes 25 and 26.
