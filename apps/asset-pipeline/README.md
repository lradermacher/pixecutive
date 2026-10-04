# apps/asset-pipeline — the command that turns Blender files into office assets

## Purpose

Builds the office assets from their Blender sources with one command: it wires the core's asset use case to the Blender adapter and writes the sheets and the manifest the browser reads.

## Owner

**App**

## Never here

⛔ What an asset is (footprint, anchor, layers, color slots): the core.
⛔ Calling Blender: the Blender adapter in `packages/infrastructure`.
⛔ The manifest's shape: `packages/protocol`.

## Entry point

`src/index.ts` — the composition root of the asset pipeline.
