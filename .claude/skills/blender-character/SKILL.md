---
name: blender-character
description: Develop a new figure or part for the office from its spec to a shipped asset — a checked Qwen reference, a cutout, a rebuild by eye in Blender through blender-mcp with every part accepted as a PNG, a silhouette check, pixel sprites per direction and animation. Use for every new character asset.
rules:
  - .claude/rules/workflow.md
  - .claude/rules/basis.md
  - .claude/rules/core.md
  - .claude/rules/ops.md
data:
  - apps/asset-pipeline/data/design-line.json
  - apps/asset-pipeline/data/reference-template.json
  - apps/asset-pipeline/data/error-types.json
gates:
  - scripts/probe-cutout.sh
  - scripts/probe-silhouette.sh
---

# blender-character — from a spec to a figure that matches its reference

At the end a figure stands in the office as a set of pixel sprites the maintainer has accepted. It is built by eye in
Blender through blender-mcp, part by part, each part accepted before the next; its parts sit on one armature. The
reference is concept art from the local Qwen model; it never ships. Why the pipeline looks this way is decided in
[ADR 0019](../../../docs/ADR/0019-the-asset-pipeline-is-an-app-of-the-hexagon.md) and
[ADR 0021](../../../docs/ADR/0021-zod-is-the-cores-one-library.md); the style comes from the
[design line](../../../apps/asset-pipeline/data/design-line.json), the figure from its spec under
[specs](../../../apps/asset-pipeline/data/specs/), the model family from
[model-routing](../../data/model-routing.md).

## Steps

0. **Check that Blender answers through blender-mcp** — ask it for the scene in this session. Modeling without the
   viewport is modeling blind: a score rises while the likeness falls. If the tools do not answer, that is the first
   sentence to the maintainer, who starts Blender with the addon's server and reloads the session; nothing is built
   before. *Done when the scene query answered in this session.*
1. **Read the spec and the design line** — every feature with its prompt sentence, check and source, every style
   choice with its value. A feature the maintainer asked for but the spec lacks goes into the spec first, with their
   words as the source. *Done when the spec names every feature to be built.*
2. **Develop the reference** — `pnpm assets reference <figure>` renders the template's views under the memory guard,
   one render at a time, checks each with the local vision model and retries at most three times; every verdict
   lands in the renders log. A new failure of the image model becomes an entry in the
   [error types](../../../apps/asset-pipeline/data/error-types.json) with its countermeasure. *Done when a verdict
   passed.*
3. **Show the reference and stop** — one PNG per render that passed, looked at before it is shown; the maintainer
   picks or rejects. Nothing is built before the yes. *Done when the maintainer accepted one reference.*
4. **Cut it out** — `pnpm assets cutout <figure> <image>` writes one transparent view per view of the template and
   refuses a different figure count. Figures the cutout cannot part are separated once by hand along their contact,
   and both views are shown before anything is built on them. *Done when every view exists and was looked at.*
5. **Build part by part, by eye** — in Blender through blender-mcp, with a viewport screenshot after every change,
   next to the same part of the reference. The head first, then body, clothes, shoes. The source is one Python build
   script per figure under [figures](../../../apps/asset-pipeline/figures/), never a binary `.blend`; every part of
   the layered part system (body, face, hair, top, bottom, shoes) is its own mesh named by its category on one
   armature with exactly the spec's joints; clothes are cut from the body, face and hair follow the head bone. Each
   part goes to the maintainer as one PNG next to the reference part, and the next part starts after the yes.
   *Done when every part was accepted and the script builds the figure into an empty scene without an error.*
6. **Check the silhouettes** — the [silhouette measure](../../../packages/infrastructure/src/adapter/Blender/silhouette.py)
   renders the figure per view from the design line's camera and compares it with the cut-out view. It is a final
   check, never a target: no value is tuned towards it, because it rewards mass where parts overlap in the
   reference. A low view is fixed by eye like any other part. *Done when every view scores at least 0.9.*
7. **Render the sprites** — per direction of the design line and per animation of the spec, flat tones per part, a
   1 pixel outline between parts in the design line's outline color, at its pixel grid, into the asset layout the
   [ops rule](../../rules/ops.md) names. *Done when every part has its sheets and the manifest names them.*
8. **Show the figure in the office and stop** — one PNG of the figure in the office render, next to its reference.
   *Done when the maintainer accepted the figure.*

## Acceptance

- [ ] The blender-mcp tools answered in the session before anything was modeled
- [ ] The reference passed the vision check and the maintainer accepted it before anything was built
- [ ] Every part was shown as a PNG and accepted before the next one started
- [ ] The figure is a build script, every part its own mesh on one armature with the spec's joints
- [ ] Every view of the template scores at least 0.9 in the silhouette measure, and no value was tuned towards it
- [ ] The sprites lie in the asset layout, per part, direction and animation, with a manifest
- [ ] The maintainer accepted the figure in the office
