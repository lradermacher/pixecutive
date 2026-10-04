# PLAN PIX-57 — Develop new assets through one pipeline

Card: PIX-57 (setup), a series with PIX-7 and PIX-56 on `feat/pix-7-skeleton-toolchain`. Goal: every new office asset
is developed the same way.
1. A guarded local Qwen render delivers a reference that follows a fixed template and the HD office pixel style design line.
2. A vision model checks the reference against the figure's spec.
3. A chroma-key cutout makes it transparent.
4. A Blender skill rebuilds the asset from it, with parts on one armature, defined joints and animations.

The first figure through the pipeline is the male base character.

## Acceptance

- [ ] A design line records the HD office pixel style as data (line, palette, proportions, eyes, pixel grid, view), each choice with its source (sheet or the maintainer's words)
- [ ] A reference template states what Qwen must deliver per figure (turnaround views, A-pose with limbs apart, flat chroma-key background, neutral clothes, size, framing, seed), and a prompt builder assembles each prompt from template, spec and error types
- [ ] A character spec format exists, and the male and female base specs are filled, including the maintainer's proportion feedback
- [ ] Error types of the image model are recorded with their countermeasures, and the prompt builder applies them
- [ ] A reference is rendered under the PIX-56 guard, checked against its spec by a local vision model with at most three retries, and every verdict is logged
- [ ] A chroma-key cutout turns the reference into transparent images per view
- [ ] A skill `blender-character` and its ruleset rebuild a figure from the reference: reference planes from the turnaround, a base mesh measured against the silhouettes, parts as separate meshes on one armature, pixel render settings
- [ ] Joints and animations per figure are recorded as data, as the maintainer decides them
- [ ] The male base figure is rebuilt through this pipeline and stands in the office as a PNG for the maintainer's verdict
- [ ] Finished assets live under `apps/office-ui/assets/<category>/<name>/` with `manifest.json`, `animations/<action>/<direction>.png` and `textures/<variant>.png`; every part of the layered part system is its own asset, and a gate rejects any other layout
- [ ] Every new mechanism has a probe or test, and verify-full is green

## Inventory

| Part | State | File |
| --- | --- | --- |
| Asset domain: enums (view, feature check, joint, animation), Zod schemas with their types (character spec, reference template, design line, error types), verdict | new | `packages/core/src/domain/Asset/*.enum.ts`, `*.schema.ts`, `verdict.interface.ts` |
| Prompt builder | new | `packages/core/src/application/service/referencePrompt.service.ts` |
| Reference loop: render, check, at most three retries, verdict | new | `packages/core/src/application/service/referenceDevelopment.service.ts` |
| Exception and keys | new | `packages/core/src/application/exception/asset.exception.ts`, `assetExceptionKey.enum.ts` |
| Ports: clock, reference renderer, vision checker, verdict log | new | `packages/core/src/port/outgoing/*.interface.ts` |
| Qwen renderer under the memory guard | extend (moved from `scripts/lib/render/`) | `packages/infrastructure/src/adapter/Render/referenceRenderer-qwen.adapter.ts` |
| Vision checker through the local Ollama model `qwen3-vl` | new | `packages/infrastructure/src/adapter/Vision/visionChecker-ollama.adapter.ts` |
| Chroma-key cutout as a headless Blender script | new | `packages/infrastructure/src/adapter/Blender/cutout.py`, `referenceCutout-blender.adapter.ts` |
| Blender helpers: reference planes, silhouette match, pixel render | new | `packages/infrastructure/src/adapter/blender/*.py` |
| Data: design line, template, base specs M and F, error types, joints and animations | new | `apps/asset-pipeline/data/*.json` |
| Composition root with the commands `reference`, `cutout`, `render` | extend | `apps/asset-pipeline/src/` |
| Skill with its steps and ruleset | new | `.claude/skills/blender-character/SKILL.md` |
| Figure build script, reproducible and readable in a diff instead of a binary `.blend` | new | `apps/asset-pipeline/figures/base-m.py` |
| Logs and render output | exists | `renders/` (gitignored, PIX-56) |
| Asset layout `<category>/<name>/{manifest.json, animations/<action>/<direction>.png, textures/<variant>.png}` | extend | `apps/office-ui/assets/` and the image check in `scripts/pre-commit.ts` |

## Placement

ADR 0019 places it.
- **Core:** what an asset is, the prompt building and the retry loop decide without touching the outside, so they
  are domain and application code.
- **Infrastructure adapters:** Qwen, Ollama and Blender touch processes and files.
- **App:** the data and the commands are configuration and wiring.
- **Skill:** the Blender rebuild is a judgment-led method, not a function, so it is a skill with its ruleset.
- **Not the repo:** Qwen references are concept art. They stay in `renders/`; only the Blender result becomes an
  asset under `apps/office-ui/assets/`.

## Standards the build follows

These are the basis and core rules applied to this card:
- **Sets of values:** an `enum` in the compiled core and app code, a frozen `as const` object with a derived type
  in scripts. No string union anywhere, and no `any`.
- **Exports:** one export per file.
- **Functions:** each one uses its arguments and returns real data.
- **Tests:** they test real code with fakes at the ports, never stubs.
- **Errors:** core exceptions with a key, translated at the app's edge.
- **Time:** comes through a clock port.
- **Model facts:** model names, the Ollama endpoint and Blender behavior are measured on this machine before they
  are written down.
- **Other games:** facts about another game's system come from their sources, never from memory. No file of another
  game is read, copied or traced.

## Behavior

- **`reference <figure> [--view all]`:** builds the prompt from template, design line, spec and error types, then
  renders one image under the guard. The vision model answers each check of the spec with pass or fail. On a fail,
  the next seed is rendered, at most three retries. Every verdict goes to `renders/verdicts.jsonl`.
- **`cutout <image>`:** measures the key color at the image border and writes one transparent PNG per view.
- **The skill:** `blender-character` leads the rebuild.
  1. Place the reference planes per view.
  2. Build the base mesh from edge loops, not stuck-together primitives.
  3. Measure the silhouette overlap per view after every step; target at least 0.9 IoU.
  4. Add the parts as separate meshes weighted to one armature with the decided joints.
  5. Render with the fixed pixel settings.

## Test plan

- **Core, unit tests with fakes:**
  - The prompt builder applies a countermeasure and rejects a forbidden phrase.
  - The loop stops after three retries and logs every verdict.
  - Each schema rejects a broken data file.
- **Adapters, probes without models:**
  - a fake mflux command
  - a fake Ollama answer
  - a synthetic green image for the cutout
  - the silhouette measure on two known shapes
- **The real run:** M reference, then cutout, then Blender rebuild, then the office PNG for the maintainer.

## Out of scope

- **Outfits, hairstyles and face variants:** they follow once the base is accepted.
- **The office renderer for figures:** that is PIX-13 and PIX-23.
- **The female rebuild:** the spec is filled here; her Blender rebuild is the next figure.

## Changed on the way

- Node 26.5 runs no TypeScript enums; the app is bundled with vite 8.3.2 (already installed through vitest, now a
  pinned dev dependency) and runs as `pnpm assets <command>`. The single `render` command became the guarded
  render inside `reference`; `status` replaces the old script's status.
- The code follows the maintainer's hexagon naming pattern with Zod 4.6.5 in the core (sheet hexagon-pattern, ADR
  0021); the hand-written parsers of step 1 were deleted with the maintainer's yes.

- The maintainer fixed the asset layout (`<category>/<name>/animations…`) and kept `apps/office-ui/assets/` as the
  place (ADR 0020 stays); card and plan got the eleventh acceptance line the same day.

## Open questions

- **The maintainer decides on the approval sheet:**
  - the design-line choices and the joints and animations, because both are art direction
  - whether `scripts/render.ts` is deleted once its guard lives in the Qwen adapter, because deletion needs his yes
    per file
- **I decide:** the IoU target of 0.9. It is a measurable start value and is tightened if the rebuild is still off.

## Order

| Step | What | Check | Status |
| --- | --- | --- | --- |
| 1 | Domain types, schemas, prompt builder, reference loop, ports | `pnpm test` in core | 73241cb, reworked to the pattern in the next commit |
| 2 | Data files from the approved sheet | schema tests green | 8b28e12 |
| 3 | Qwen, vision, verdict log, clock and cutout adapters; the old render script deleted (F4) | adapter specs, `bash scripts/probe-cutout.sh` | e2686ca |
| 4 | App commands `reference`, `cutout`, `status`, bundled by vite for Node | `pnpm assets reference base-m --dry` | f987626 |
| 5 | Skill `blender-character`, ruleset, Blender helpers with probe | `node scripts/check-skills.ts`, silhouette probe | open |
| 5b | Asset layout and its gate with probe cases; the ops rule names the layout | `bash scripts/probe-pre-commit.sh` (59) | this commit |
| 6 | Real run: M reference, cutout, Blender rebuild, office PNG | the maintainer's verdict on the PNG | open |
| 7 | Full gate | `node scripts/verify-full.ts` | open |
