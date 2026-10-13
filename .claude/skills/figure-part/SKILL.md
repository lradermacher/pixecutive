---
name: figure-part
description: Draw one part of a figure (a face part, hair, a garment, shoes or an accessory) with an image model on the key template, cut it into a layer that takes any color and check it in every combination it meets before the maintainer sees it. Use for every new or redrawn figure part.
rules:
  - .claude/rules/assets.md
  - .claude/rules/workflow.md
data: []
gates: []
---

# figure-part — one part that fits every figure, pose, color and neighbor

At the end one part exists as a layer per pose of each figure: cut clean, colored at runtime where it carries a
main color, drawn to meet every layer it touches, and accepted by the maintainer in the office's own render. Why
parts are drawn and not built or clipped by code is decided in
[ADR 0022](../../../docs/ADR/0022-assets-are-drawn-from-our-own-templates-and-checked-by-eye.md).

## Steps

1. **Agree the target** — one cheap PNG of the part on the figure. *Done when the maintainer said yes.*
2. **Prepare the input** — the figure's approved still or pose grid; everything the part does not cover painted flat
   key green. For a layer that takes a color, the area the part replaces is painted green as well. Head parts:
   `pnpm assets grid <figure> <grid>` puts the still's box into every cell of a grid, and
   `pnpm assets hair-under-hat <figure> <id>` lays the hat on a hairstyle for its drawing under the hat. *Done when the
   input shows only what the drawing may keep.*
3. **Draw the part** — the image model draws it on every pose of the grid. A part with two sides (eyes, brows,
   shoes) is asked for as one matching pair. A mark such as our logo is drawn into the part from its source file,
   never stamped by code. Head parts: `pnpm assets draw <figure> <kind> <drawing>` makes one call with its prompt from
   [the head prompts](../../../apps/asset-pipeline/data/head/), and `pnpm assets split <figure> <kind> <drawing>`
   splits a drawn grid into one still per variant. *Done when every pose carries the part.*
4. **Compare with the approved neighbor** — the new drawing whole, next to an approved part of the same figure;
   pairs zoomed side by side. Drift in line, shading or proportion is redrawn. *Done when nothing drifts.*
5. **Cut it by key** — keyed on the green only, with the green spill removed; the silhouette is checked against the
   input, and a drawing that changed the figure's shape is redrawn. Head parts: `pnpm assets cut <figure> <kind> <id>`
   cuts a variant into its layer (a hat with its hide), and `pnpm assets fit <figure> <kind> <id>` fits one made on
   another figure. *Done when every pose is cut and its edge looked at zoomed.*
6. **Make it take any color** — a neutral grey layer that carries the main-color mark, made from the approved drawing.
   Prints, logos and fun pieces keep their own colors; laces stay white. *Done when the part takes any color in
   the office and its marks keep theirs.*
7. **Draw where it meets another layer** — a meeting of two layers is drawn, once per class of the other layer: a
   trouser per shoe class, hair under a hat. After the second rule that failed to clip a meeting, the input changes
   instead. *Done when every meeting has its drawing.*
8. **Check through the office's own draw functions** — zoomed, on light, medium and dark looks, in several colors,
   and in every combination with the layers it meets. One post-processing change at a time, each against the raw
   drawing. `pnpm assets export <figure> <motion>` puts the parts into the manifest, and `pnpm playground` wears them
   on every motion. *Done when the full matrix was looked at.*
9. **Show it and stop** — before and after, zoomed. A taste call goes to the maintainer on a
   [decision sheet](../decision-sheet/SKILL.md); a clear defect is fixed first. *Done when the maintainer accepted
   the part.*

## Acceptance

- [ ] The target was agreed as one PNG before anything was drawn
- [ ] Every pose of every figure carries the part, cut by key, its edge looked at zoomed
- [ ] The new drawing was compared whole with its approved neighbor, pairs side by side
- [ ] The part takes any color at runtime where it carries a main color, and its marks keep theirs
- [ ] Every meeting with another layer is drawn, not clipped by a rule
- [ ] The full matrix of combinations was checked through the office's own draw functions
- [ ] The maintainer accepted the part
