# apps/asset-pipeline — the command line that makes office assets

## Purpose

Makes the office assets with one command per step: it wires the core's asset use cases to the generation adapters, so every local render runs one at a time under the memory guard. Today it renders one image and shows the renderer's status.

## Owner

**App**

## Never here

⛔ What an asset is (parts, layer order, color slots, variants): the core.
⛔ Calling a model, a service or an image step: its adapter in `packages/infrastructure`.
⛔ The manifest's shape: `packages/protocol`.

## Entry point

`src/main.ts` — the command line and the composition root of the asset pipeline.
