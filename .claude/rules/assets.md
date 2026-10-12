---
paths:
  - "apps/asset-pipeline/**"
  - "apps/office-ui/assets/**"
  - "packages/infrastructure/src/adapter/Render/**"
adr: docs/ADR/0022-assets-are-drawn-from-our-own-templates-and-checked-by-eye.md
summary: >
  Image models draw every part from our own templates, a local video model makes every motion, nothing comes from
  another game. One local render at a time under the memory guard. A gesture is defined before its first render;
  where layers meet, the meeting is drawn. Every result is looked at through the office's own draw functions first.
---

# Assets — how they are made

## Nothing from another game enters the repo
No file, no traced shape, no name. `[Gate history guard denylist]`

## A local model renders one job at a time under the memory guard
The lock refuses a second render in the same renders folder; the guard refuses any start under pressure and stops a
run at critical pressure.
`[Gate verify-full: renderer spec]`

## Motion comes only from the local video model
A cycle is cut from a free clip, a gesture on the spot is a loop anchored on the same still; no part is stretched,
rotated or moved by code. `[Skill animate-figure]`

## A gesture is defined in its card before its first render
What moves, what stays still, the timing and the measured check. `[Skill animate-figure]`

## Where two layers meet, the meeting is drawn
One drawing per class of the other layer; after the second rule that failed to clip a meeting, the input changes.
`[Skill figure-part]`

## A new drawing is compared whole with its approved neighbor
Pairs such as eyes and brows zoomed side by side; drift is redrawn, not patched. `[Skill figure-part]`

## A result is checked through the office's own draw functions
Zoomed, on light, medium and dark looks, and in every combination where two layers meet.
`[Skill figure-part · Skill animate-figure]`

## A score checks a result; nothing is tuned towards it
`[Prose: whether a value was tuned shows only in the session]`

## A visual result is looked at before it is shown or built on
`[Prose: looking is a judgment]`
