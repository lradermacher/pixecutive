# apps/asset-pipeline — the command line that makes office assets

## Purpose

Makes the office assets with one command per step: it wires the core's asset use cases to the generation adapters, so every local render runs one at a time under the memory guard. It renders one image and shows the renderer's status, and it makes a figure's motion: `clip` renders it with the local video model, `frames` cuts it into sprites, `track` places the head per frame, `export` writes the sprites, face parts and manifest into `apps/office-ui/assets/figures`. The figures' values and prompts lie in `data/`.

## Owner

**App**

## Never here

⛔ What an asset is (parts, layer order, color slots, variants): the core.
⛔ Calling a model, a service or an image step: its adapter in `packages/infrastructure`.
⛔ The manifest's shape: `packages/protocol`.

## Entry point

`src/main.ts` — the command line and the composition root of the asset pipeline.
