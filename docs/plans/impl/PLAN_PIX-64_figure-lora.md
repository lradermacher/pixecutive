# PLAN PIX-64 — Test a figure LoRA that keeps the image model on the approved look

Card: PIX-64 (research), on the series branch `feat/pix-7-skeleton-toolchain` before the rest of PIX-58 (sheet
`pix58-anim-next` F1). Goal: measure whether a LoRA trained on the approved drawings of M keeps redrawn frames
consistent (face, hair color, shading, position), so gestures can become frame sequences of real drawings.

## Acceptance

- [ ] Training time, memory peak and swap of one training run are measured on this Mac under the guard
- [ ] The same prompts are rendered with and without the LoRA, and the drift against the approved drawing is measured (head position, hair and skin color, shirt shading)
- [ ] The result goes to the maintainer as one sheet with the side-by-side images and the numbers, and a recommendation to adopt or drop it

## Inventory

| Part | State | File |
| --- | --- | --- |
| Trainer `mflux-train` 0.19.1, edit training from `*_in` / `*_out` pairs with a prompt per pair | exists, untested | local install |
| Approved base M and 16 approved M poses with their prompts | exists | `renders/base-m-hd-front-left.png`, `renders/base-m/poses-hd/`, scratchpad prompts |
| Render guard (pressure and swap stop, one render at a time) | exists | scratchpad render scripts |
| Training set as pairs: base → pose, prompt per pair | new | `renders/lora/m-train/` (gitignored) |
| Training config for `qwen-image-edit` (LoRA targets, rank, epochs) | new | `renders/lora/m-train.json` (gitignored) |
| Drift measure: head position by the nose point, mean Lab of hair, skin and shirt against the approved drawing | new | scratchpad script |

## Placement

- **Outside the repo:** this card measures; nothing enters `apps/asset-pipeline` before the verdict. If the LoRA is
  adopted, training and the drift measure move into the pipeline with PIX-57 under the hexagon (ADR 0019).
- **Renders and weights stay out of git** (`renders/` is gitignored).

## Standards the build follows

- **One heavy job at a time under the guard:** training stops at critical memory pressure or 16 GB of new swap, like
  the renders; never alongside a render.
- **Measured, not claimed:** time, memory peak and swap are read from the run, the drift from the images.
- **Look before showing:** every image on the sheet is looked at as a whole against the approved drawing.

## Behavior

- **Training set:** 12 of the 16 approved poses train; 4 are held out (wave, point, phone, eat) to measure on prompts
  the LoRA has not seen.
- **Dry run first:** `mflux-train --dry-run` checks config and data before the real run.
- **Comparison:** for the 4 held-out prompts and 2 new gesture frames (arm half raised, arm out), one render each with
  and without the LoRA, same seed; drift per image against the approved base.

## Test plan

- **Measured:** training time, peak memory, swap growth; per image the head offset in px and the Lab distance of hair,
  skin and shirt to the base.
- **The maintainer:** one sheet with the image pairs, the numbers and my recommendation.

## Out of scope

- **A style LoRA for props and rooms:** only after a positive figure result.
- **F:** trained the same way only if M is adopted.

## Decided

- **Base:** the approved base image of M is the input of every pair, as in the pose renders.
- **Held-out set:** the 4 held-out poses are those a gesture of PIX-58 needs first (wave, point, phone, eat).

## Open questions

None.

## Order

| Step | What | Check | Status |
| --- | --- | --- | --- |
| 1 | Training set as pairs and the config; `--dry-run` | dry run passes | open |
| 2 | One training run under the guard, time, memory and swap logged | the log holds the three numbers | open |
| 3 | Renders with and without the LoRA, drift measured | a table of drift per image | open |
| 4 | Sheet with images, numbers and recommendation | the maintainer's verdict | open |
