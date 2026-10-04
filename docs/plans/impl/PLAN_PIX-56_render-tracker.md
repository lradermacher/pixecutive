# PLAN PIX-56 — Track local image renders with a memory guard, a render log and a status view

Card: PIX-56 (setup), a series with PIX-7 on `feat/pix-7-skeleton-toolchain`. Goal: every local sketch render runs
under a guard, leaves one log row and can be watched while it runs. The MacBook must never run out of memory again
because of a render.

## Acceptance

- [ ] A render started through the script writes one log row with every field above, including on abort
- [ ] The guard aborts at critical memory pressure or at the swap limit, and the row says why
- [ ] A status command shows the running render's step and the last rows of the log
- [ ] The log file is gitignored, and the script has a probe or test
- [ ] verify-full is green
- [ ] ticket.ts opens a card on a branch of an earlier card of the same series once that card's package is closed, and the probe covers it

## Inventory

| Part | State | File |
| --- | --- | --- |
| Render entry with `run` and `status` | new | `scripts/render.ts` |
| Memory reading (pressure level, swap in MB) | new | `scripts/lib/render/read-memory.ts` |
| Guard decision: refuse, continue or abort | new | `scripts/lib/render/judge-memory.ts` |
| Log row: format and append | new | `scripts/lib/render/render-log.ts` |
| Output folder and log | extend | `.gitignore` gets `renders/` |
| Probe with a fake render command and a fake memory reader | new | `scripts/probe-render.sh` |
| Series: open a card on the branch of an earlier closed card of the same series | extend | `scripts/ticket.ts`, its probe |
| Unit tests for the guard decision and the log row | new | `scripts/lib/render/*.spec.ts` |

## Placement

`scripts/`, not the hexagon. The renders are concept sketches for the visual flow and never ship as office assets
(sheet asset-source F2: no AI-generated assets). ADR 0019 places assets that ship in the hexagon; this is tooling,
like the other scripts. Values are frozen `as const` objects, as hooks and gates require, since Node runs the file
directly.

## Behavior

- `node scripts/render.ts run --input <png> --prompt <txt> --name <name> [--seed N]` renders exactly one image with
  Qwen-Image-Edit-2511 (8-bit MLX, Lightning LoRA, 8 steps), through `mflux-generate-qwen-edit`.
  - It refuses to start while another render runs, or when the memory pressure level is 2 or higher.
  - Every 5 s it reads the pressure level and the swap. At level 4 or at +8192 MB swap since the start, it aborts.
  - It writes the image and one log row into `renders/`.
- The log row holds: date, name and seed, model, steps, size, time to the first step, total time, seconds per step,
  peak pressure, swap peak and result. On abort, the result names the reason.
- `node scripts/render.ts status` shows the running render's step as `n/8` from its output, the current pressure
  and swap, and the last five log rows.

## Test plan

- Unit tests: the guard decision at levels 1, 2 and 4, at the swap limit and just below it; the log row for a
  finished render and for an aborted one.
- Probe `probe-render.sh` covers four cases:
  - a fake render command that finishes, which leaves an image and a log row
  - a fake memory reader at level 4, which leaves an abort row naming the reason
  - a start at level 2, which is refused
  - `status` while the fake render runs, which shows the step
  The probe sets the render command and the memory reader through environment variables, so no model is loaded.

## Out of scope

- A vision check of the result: it needs its own card once the flow uses it.
- A queue of several renders: one at a time is the rule.
- Text-to-image without an input image: not needed for sketches yet.

## Changed on the way

- ticket.ts rejected PIX-56 on the PIX-7 branch although ADR 0002 allows a series; series support became step 0
  and the sixth acceptance line (card updated the same day).

## Open questions

- Model paths: the Hugging Face cache path is standard for every machine, so it is not local config. I decide this,
  because it follows from the measured install.

## Order

| Step | What | Check | Status |
| --- | --- | --- | --- |
| 0 | ticket.ts series: probe red, then green; PIX-7 package closed, PIX-56 opened | `node scripts/ticket.ts show` names PIX-56 | open |
| 1 | Guard decision and log row with unit tests | `npx vitest run scripts/lib/render` | open |
| 2 | Memory reading and the render entry with `run` and `status` | `node scripts/render.ts status` | open |
| 3 | Probe red, then green; `.gitignore` | `bash scripts/probe-render.sh` | open |
| 4 | One real render of the female sketch under the guard | log row in `renders/renders.tsv` | open |
| 5 | Full gate | `node scripts/verify-full.ts` | open |
