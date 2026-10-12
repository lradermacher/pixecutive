# PLAN PIX-56 — Track local image renders with a memory guard, a render log and a status view

Card: PIX-56 (setup), a series with PIX-7 on `feat/pix-7-skeleton-toolchain`. Goal: every local render runs under a
guard, leaves one log row and can be watched while it runs. The MacBook must never run out of memory again
because of a render.

## Acceptance

- [x] A render started through the script writes one log row with every field above, including on abort — `localRenderer-mflux.adapter.spec.ts`: "answers the image and logs a done row with every column" and the two abort cases; real rows in renders/renders.tsv
- [x] The guard aborts at critical memory pressure or at the swap limit, and the row says why — the adapter spec's cases for level 4 and +16900 MB swap over the 16384 MB limit; a real abort at +9971 MB swap (sheet-m, 2026-10-04)
- [x] A status command shows the running render's step and the last rows of the log — the adapter spec's case "names the running render with its current step while it runs" and "shows the running render, the memory and the last log rows"; `showRenderStatus.handler.spec.ts`
- [x] The log file is gitignored, and the script has a probe or test — `.gitignore` has `renders/`; the adapter, handler and composition root specs run in `pnpm test`
- [x] verify-full is green — STAGE 2 GREEN after 9f48bcb; again before the series' pull request (PIX-57 step 10)
- [x] ticket.ts opens a card on a branch of an earlier card of the same series once that card's package is closed, and the probe covers it — 4f38a80, probe-ticket.sh two series cases (99 green)

## Inventory

| Part | State | File |
| --- | --- | --- |
| The render port and its use case | new | core `port/outgoing/localRenderer.interface.ts`, `application/service/renderImage.service.ts`, `domain/Render/` |
| The guarded render: lock, memory guard, log row, step in the lock | new | infrastructure `adapter/Render/localRenderer-mflux.adapter.ts` |
| Memory reading (pressure level, swap in MB) and the guard decision | new | infrastructure `adapter/Render/readMemory.ts`, `judgeMemory.ts` |
| Log row: format | new | infrastructure `adapter/Render/renderLogRow.ts` |
| The commands `render` and `status` | new | `apps/asset-pipeline/src/cli/renderImage.handler.ts`, `showRenderStatus.handler.ts`, `runPipeline.ts` |
| Output folder and log | extend | `.gitignore` gets `renders/` |
| Series: open a card on the branch of an earlier closed card of the same series | extend | `scripts/ticket.ts`, its probe |

## Placement

In the hexagon (ADR 0019): the guard touches processes and files, so it is an adapter behind the core's render port;
the use case checks the job; the asset pipeline app wires them and offers the commands. Renders that ship as assets
and renders that only sketch go through the same guard.

## Behavior

- `pnpm assets render <prompt file> <input image> <seed> [<width>x<height>]` renders exactly one image with
  Qwen-Image-Edit-2511 (8-bit MLX, Lightning LoRA, 8 steps), through `mflux-generate-qwen-edit`.
  - It refuses to start while another render runs, or when the memory pressure level is 2 or higher.
  - Every 5 s it reads the pressure level and the swap. At level 4 or at +16384 MB swap since the start, it aborts.
  - It writes the image and one log row into `renders/`.
- The log row holds: date, name and seed, model, steps, size, time to the first step, total time, seconds per step,
  peak pressure, swap peak and result. On abort, the result names the reason.
- `pnpm assets status` shows the running render with its step as `n/8`, the current pressure and swap, and the last
  five log rows.

## Test plan

- The adapter spec runs a fake mflux and a fake memory reader, so no model is loaded: a finished render leaves an
  image and a full log row; level 4 and the swap limit leave an abort row naming the reason; a start at level 2 is
  refused; a second render is refused; the status names the running step and the last rows.
- The handler and composition root specs cover the commands and every exit code.

## Out of scope

- A vision check of the result: dropped with the reference loop (PIX-57).
- A queue of several renders: one at a time is the rule.
- Text-to-image without an input image: not needed yet.

## Changed on the way

- Scripts in this repo are tested by probes, not Vitest (Vitest covers packages and apps only); the unit-test
  cases of the test plan ran in `probe-render.sh`.
- ticket.ts rejected PIX-56 on the PIX-7 branch although ADR 0002 allows a series; series support became step 0
  and the sixth acceptance line (card updated the same day).
- 2026-10-04 (PIX-57, maintainer): the swap brake rose to +16384 MB, because loading the model alone swaps several GB;
  the guard moved from `scripts/render.ts` into the render adapter, and the script with its probe was removed.
- 2026-10-12 (PIX-57): the adapter became the general local renderer port with its commands `render` and `status`;
  the status shows the running step again, which the move into the adapter had lost. Card and plan say the same.

## Open questions

- Model paths: the weights are looked up in the Hugging Face cache the way the hub reads it (`HF_HUB_CACHE`,
  `HUGGINGFACE_HUB_CACHE`, `HF_HOME`, `XDG_CACHE_HOME`, then `~/.cache/huggingface/hub`, with `~` and `$NAME`
  expanded, measured in the installed `huggingface_hub`), and `PIX_LORA` overrides it; so it is not local config. I decide this, because it follows from
  the measured install.

## Order

| Step | What | Check | Status |
| --- | --- | --- | --- |
| 0 | ticket.ts series: probe red, then green; PIX-7 package closed, PIX-56 opened | `node scripts/ticket.ts show` names PIX-56 | 4f38a80 |
| 1 | Guard decision and log row | covered by the probe of step 3 | 0b78c77 |
| 2 | Memory reading and the render entry with `run` and `status` | `node scripts/render.ts status` | 0b78c77 |
| 3 | Probe red, then green; `.gitignore`; probe row in the pre-commit | `bash scripts/probe-render.sh` (8 cases) | 0b78c77 |
| 4 | Real renders under the guard (base M, base F, sheets) | log rows in `renders/renders.tsv` | 9f48bcb |
| 5 | Full gate | `node scripts/verify-full.ts` | this commit |
