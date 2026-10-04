---
paths:
  - "apps/asset-pipeline/**"
  - "apps/office-ui/assets/**"
  - "packages/infrastructure/src/adapter/Render/**"
  - "packages/infrastructure/src/adapter/Vision/**"
  - "packages/infrastructure/src/adapter/Blender/**"
adr: docs/ADR/0022-assets-are-our-own-work-made-by-eye.md
summary: >
  Assets are our own work: a generator's output is a reference only, nothing comes from another game. The image model
  renders one image at a time under the memory guard. A figure is modeled by eye through blender-mcp, each part
  accepted as a PNG before the next; a score is a check, never a target; results are looked at first.
---

# Assets — how they are made

## A generator's image or model never ships
It is a reference only; what ships is built by hand. `[Agent adversarial-review]`

## Nothing from another game enters the repo
No file, no traced shape, no name. `[Gate history guard denylist]`

## The image model renders one image at a time under the memory guard
A lock refuses a second render; the guard refuses a start under pressure and stops a run at critical pressure.
`[Gate verify-full: renderer spec]`

## A figure is modeled with the viewport
blender-mcp answers before the first change, and every change is looked at in the viewport.
`[Skill blender-character]`

## Every part is accepted as one PNG before the next starts
`[Skill blender-character]`

## A score checks a result; nothing is tuned towards it
`[Prose: whether a value was tuned shows only in the session]`

## A visual result is looked at before it is shown or built on
`[Prose: looking is a judgment]`
