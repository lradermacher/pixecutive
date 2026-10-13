# PLAN PIX-78 — Bring the head parts by green key into the asset pipeline: hair, beards, hats, glasses and face variants as commands

Card: PIX-78 (feature), on the collection branch `feat/pix-7-skeleton-toolchain` (ADR 0024), before PIX-70; split
from PIX-70 by the maintainer on sheet `pix70-cut` (F1 = a, F2 = a) on 2026-10-13. Goal: every head part of M and F
is made, cut and placed by `pnpm assets` commands and follows every gesture by the per-frame head origin, with the
Astra adapter and the key cut built so that PIX-70 reuses them for the body parts.

## Acceptance

- [x] Each step of the head-parts chain (green head templates, hair and beards, hats with hide masks, glasses, hair under hats with its lift, face-part variants) runs as a command of `apps/asset-pipeline`, with its decisions in the core and its tools behind adapters — `pnpm assets grid|draw|split|cut|hair-under-hat|fit` (ee17a18), decisions in `MakeHeadPartService` and `HeadPartsService`, tools behind `IImageEditor` (Codex) and `IPartCutter` (OpenCV); the lift by `export`
- [x] Every core decision has unit tests with in-memory fakes, every adapter its own spec — core specs with `InMemoryImageEditor` and `InMemoryPartCutter`; `imageEditor-codex.adapter.spec.ts` against a stub CLI, `partCutter-opencv.adapter.spec.ts` on synthetic scenes, `assetStore-files.adapter.spec.ts` for `putHead` and `putFigureHead`
- [x] One hairstyle, one hat and one pair of glasses made through the commands match their proof-of-concept layers, compared zoomed through the page's draw functions — m hair 1, m hat 4 with its hide and m glasses 1 cut through the commands from the backup's drawings differ by 0 from its layers (step 6); the same bytes go through the playground's own `drawFigure`; zoomed comparison PNG with three fresh drawings
- [x] The hair, beards, hats, glasses and face variants of M and F reach `apps/office-ui/assets/` and the manifest through the commands — split, cut and export: 404 of 406 layers equal the backup's (the two others are hidden variants); M 176 and F 181 head parts per motion, lifts 61 of 61 equal to the backup; `shippedFigures.spec.ts` checks every file named and named once
- [x] Every head part follows each gesture (idle, walk, wave, sit, type) by the per-frame head origin, checked in the playground — the export places every part on every motion by its head origin; checked in `pnpm playground` through the page's own buttons and draw functions on all five motions, both facings, 4× zoom (hair, hats incl. the chef hat over long hair, glasses, beard, eye variant)
- [x] The skill `figure-part` names the commands — steps 2, 3, 5 and 8 of `.claude/skills/figure-part/SKILL.md`
- [x] Every gate and verify-full is green, and an independent review checked the diff — verify-full STAGE 2 GREEN; review run 1 on the card's whole diff (record f06095c, 17 findings, fixed in 87eb959), run 2 on the rework (9 findings, fixed in the commit its record lies on)

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
| 3 | Port and adapter `IImageEditor` / `imageEditor-codex.adapter.ts`, the binary path from the local config | adapter spec against a stub `codex` green | 65ba227 |
| 4 | Port and adapter `IPartCutter` / `partCutter-opencv.adapter.ts` with `Parts/parts.py`: grid, split, key cut, hat cut with hide, glasses cut, face-variant cut, skull top and first row | adapter spec on synthetic scenes green | d897df7 |
| 5 | Services and commands `grid`, `draw`, `split`, `cut`, `hair-under-hat`, and the data: prompts, variant lists, green sources | handler specs green; `pnpm assets grid m head` equals BK `m_green_head.png` | ee17a18 |
| 6 | Line 3: cut m hair 1, m hat 4, m glasses 1 from the backup's renders and compare; one fresh draw per kind | pixel and alpha difference reported; zoomed PNG to the maintainer | 934fc1c; difference 0 for all three, zoomed PNG with the fresh drawings |
| 7 | Export extended; import every head part of M and F from the backup's renders through split and cut | lift 75/75 equal to BK; manifest parses; assets folder holds every head part | 3c7993c and the assets commit; lifts 61/61 (the offered hairstyles) |
| 8 | Playground: head layers, pickers, hide by `destination-out`, hat lift | playground specs green; every head part on all five motions, both facings, zoomed, checked in the browser | 3c7993c and the headroom in the assets commit |
| 9 | Skill `figure-part` names the commands, the assets rule if a line changes | check-skills, check-rules green | the assets commit |
| 10 | verify-full, the boxes, the review | verify-full green, `ticket.ts boxes` with no open box, review record on the head | the commit review run 2's record lies on |

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
- 2026-10-13, step 4:
  - **Parity with the proof of concept**, measured. `parts.py` carries the backup's cut scripts over line by line,
    and run on the backup's own inputs it writes the backup's layers with a difference of 0:
    - m hair 1, m beard 1, m hair under hat 1, m hat 4 with its hide, m glasses 1;
    - all 81 face variants of M and of F;
    - the head and tall grids of M and F;
    - the split of a hair grid.
  - **Three things found on the way to that parity:**
    - The face variants keep 6 pixels from the head's outline for the brows and 9 for eyes, nose and mouth. The
      backup ran its brows with an override that no script records, and 6 is the value that reproduces all 18 of
      them. So `edge` is now a value per part.
    - The variant cut reads its aligned drawing in 8 bits, as the backup stored it.
    - Grid cells all have the size of the first cell (341), and the uncovered line at 682 takes the color of the
      still at the box's top left corner. `HeadPartsService.cell` follows that.
  - **A third green still:** glasses and hats are cut against the accessory variant of the green still, which keeps
    skin fringes at the features (4.5k to 5k pixels differ). It comes in as a source beside the other two, under the
    same decision (sheet `pix78-plan` F2).
  - **Where the sources go:** the figure sources (open, blank, mask, default parts) already lie in the local renders
    folder `renders/figures/<n>/`, outside git. The green stills go there too, not into `apps/asset-pipeline/data/`.
  - **Smaller changes:**
    - The kernel sizes of the cuts stay named in `parts.py`, where they are part of the algorithm. The thresholds a
      change would tune are in `headCutConfig`.
    - A new key `figure.cut_failed` gets exit code 27.
- 2026-10-13, step 5:
  - **A sixth command:** `pnpm assets fit <figure> <kind> <id>`. It carries the warp of a layer from another figure,
    which the plan named only as an option of the cut.
  - **The grid belongs to each drawing,** not to its kind: F's hair is drawn in the head grid and in the tall grid.
  - **New in the spec:**
    - `hidden`: the variants drawn and cut but not offered, F's 14 hairstyles clipped by their grid cell.
    - The open still, on which face variants are aligned and the skull is measured.
  - **The cell-to-variant mapping, measured:** the backup records no cell-to-variant mapping, so every drawn grid was
    split and its cells matched to the variant stills by their bytes. All hair, beard and face grids map in order.
  - **F hair without a grid:** F's hair 40 to 48 come from no grid that maps, so they have no drawing in the data, and
    their stills are imported as they are.
  - **The prompts,** taken from the backup's scripts and logs:
    - The CLI framing ("Use your image generation tool...", "Save the resulting image...") is the adapter's.
    - `{who}`, `{what}` and `{styles}` fill the rest.
    - British spellings became American for the English gate.
  - **Two model inputs differ from the backup, measured:**
    - The face grid is off by up to 7 levels (mean 0.18), from an unknown resampling of its producer.
    - The hair-under-hat input was made with a version of the beanie that the backup no longer holds.

    Both are only what the model draws on. The cuts that count are exact (step 4).
  - **Output folders:** the commands make the folders they write into. The first real `grid` run failed without them,
    and a spec now covers it.
- 2026-10-13, step 6:
  - **Through the commands, exact:** `split m hair 1`, then `cut m hair 1`, `cut m hat 4` and `cut m glasses 1`, run
    on the backup's own drawings, write the backup's layers and the hat's hide with a difference of 0.
  - **Fresh drawings:** the first fresh run failed in Codex with "No such file or directory", because the CLI starts
    in the output's folder, which a first drawing of a kind has not made. The image editor makes that folder now, and
    a spec covers it. The three fresh drawings then came through: hair 12,700 pixels, hat 14,647, glasses 1,561.
- 2026-10-13, steps 7 and 8:
  - **The export** writes every offered head part per motion through the asset store's `putHead`. The face step
    scales it exactly like a face part. The figure's lifts and open hats go under `head` in the manifest
    (`putFigureHead`), and `putMotion` keeps them.
  - **The lifts** are measured in one Python pass for all hairstyles (`firstRows`), not one process per hairstyle.
  - **F hair under hats:** F's hair under hats exist as drawings for 35 hairstyles, the 34 offered and 41, which is
    hidden. The data names those 35, and the 13 older layers in the backup that no drawing produced stay out.
  - **The playground** draws the look of each figure: face variants in place of the default parts, then beard, the
    hat's hide (cut with `destination-out`), the hair or its drawing under the hat, glasses and the hat, which rises by
    the hair's lift. These are the backup page's rules (`cw_template.html`). Its trim of hair under a hat stays with
    the office renderer, as the plan's out of scope says.
- 2026-10-13, steps 7 to 9, the checks:
  - **The import:** split, cut and export of every head part. 404 of 406 layers equal the backup's. F hair 28 (1 pixel)
    and F hair under hat 41 (957 pixels) differ, both hidden and not shipped. F's glasses and hats come exactly from
    F's own drawings, so no fit was needed.
  - **The lifts:** 61 of 61 offered hairstyles have the backup's lift, clamped to 0 to 30 as its page clamped it. The
    plan's 75 counted the hidden ones.
  - **Body frames and face parts** of all ten motions came out of the new export byte for byte as before.
  - **Headroom in the playground:** the figure was assembled on a canvas of the sprite's size, so a chef hat raised
    over hair was cut at the top. The playground now grows the canvas by the headroom the head parts need in any
    frame (`headroom.ts`), measured in the browser with the chef hat over long hair on M and F.
  - **The skill** names the commands, its prompt folder as a link.
- 2026-10-13, the manifest's size:
  - **The problem:** with every head part on every motion the manifest grew to 444 KB, and the pre-commit holds every
    file under `apps/office-ui/assets/` to 256 KB.
  - **The fix:** the asset store now writes it on one line, with every placement and head origin at four decimals (a
    ten-thousandth of a sprite pixel). It is now 216 KB, and `shippedFigures.spec.ts` holds the manifest to the limit
    too.
  - **For PIX-70:** garments placed per frame would pass the limit again. That card has to keep the parts per figure,
    or split the manifest.
- 2026-10-13, review run 1 (17 findings: 1 blocker, 6 should, 3 minor, 7 notes):
  - **Blocker, fixed:** a drawing left at the output by an earlier call counted as a new one, so a used-up quota read as
    "drew". The editor now takes only a drawing written after it started, and a spec covers it.
  - **Placement, fixed:** three decisions moved from the handlers into `MakeHeadPartService`: the still a kind is drawn
    on (`template`), the offered variants (`offered`), and the figure's lifts and open hats (`figureHead`).
  - **The order of the head layers:**
    - The manifest carries neither an order nor the skull top. The order is the protocol's `HeadLayer` enum, which the
      playground now draws by.
    - The skull top is only used for the lifts, which the export computes, so the manifest does not carry it.
    - The core's own `HeadLayer` enum, unused and added by this card, is gone again.
  - **Reconnects:** the Codex CLI retries a reconnect itself (its logs show "Reconnecting n/5"), so the adapter does
    not repeat it. This replaces the plan's retry.
  - **`parts.py`:**
    - Its header says what it is: the tuned thresholds come from the core, and the kernel sizes and fixed steps are the
      algorithm's.
    - One literal that copied `key.background` now reads it.
  - **Cutter specs added:** beard, hair under a hat, face variant, the hair-under-hat input and the fit.
  - **The UI's lift cap of 30 is gone:** the export already clamps, and the headroom takes the figure's largest lift.
  - **Smaller fixes:**
    - Hair under a hat must name its hat and shrink in the schema.
    - F's hats and glasses no longer carry `fittedFrom`, since their own drawings are exact.
    - The comments on open hats and on the first row now say what the code does.
    - Long comment lines are rewrapped.
  - **Note, not changed:** `pnpm assets export` needs the offered head layers in the renders folder, as it needs the face
    sources. Exporting a body motion on a fresh machine needs both.
- 2026-10-13, review run 2 (9 findings: 4 should, 5 notes):
  - **The cutter specs could not fail.** The reviewer's six mutants of `parts.py` showed that four specs stayed green
    with the behavior they name removed. The scene now has:
    - strokes over the eye and the nose, and a stroke from the beard up the forehead;
    - a strand beside the hairstyle;
    - a second change at the nose for the brows;
    - a count of the magenta pixels and of the fitted layer's pixels.

    All six mutants turn the specs red now.
  - **The image for hair under a hat** is picked by `template` too, so the handler keeps no choice.
  - **The draw handler's spec** runs the real service, not a copy of its logic.
  - **Smaller fixes:** the editor's message says "no new" drawing, and a docstring is rewrapped.
  - **Not changed:** `template` and `offered` decide without touching anything and sit in the use-case service beside
    the calls they feed. The core rule allows domain or application.
