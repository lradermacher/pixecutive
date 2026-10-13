# PLAN PIX-58 — Animate the base figures from the video model: talk, wave, sit and type

Card: PIX-58 (feature), a series with PIX-7, PIX-56, PIX-57, PIX-66 and PIX-71 on `feat/pix-7-skeleton-toolchain`,
after PIX-66 and PIX-71 (maintainer, sheet `pix71-plan` F2 = a, 2026-10-13), through the asset pipeline's commands.
Goal: the base figures M and F talk, wave, sit and type in the office the way idle and walk were made in PIX-65, each
motion made by the local video model from the approved still, defined before its first render and accepted by the
maintainer. Decided on sheet `pix57-clean-branch` F7 and F8 (2026-10-12).

## Acceptance

- [ ] Wave, sit and type exist for M and F front-left, each made by the video model from the approved still; talk is the idle body with drawn mouth states
- [ ] Each gesture's definition stands in this card before its first render, and its check is measured before it is shown
- [ ] Front-right exists for every animation by mirroring
- [ ] Every face, hair, garment and accessory layer follows each gesture by the per-frame head origin
- [ ] Every gesture is checked in the room page, frames overlaid and zoomed at the joints, before the maintainer sees it
- [ ] The maintainer approves each gesture with a verdict

## Inventory

| Part | State | File |
| --- | --- | --- |
| Approved stills of M and F; the standing still with a blank face | exists, outside the repo (images live only in the asset folder) | figure sources folder `renders/figures/{m,f}/walk-start.png`, `blank2.png` |
| Video clip in `loop` or `cycle` mode under the memory guard | exists (PIX-66) | `pnpm assets clip`, `adapter/Video/` |
| Frame cut, head track, export with face parts and manifest | exists (PIX-66) | `pnpm assets frames`, `track`, `export` |
| The figures' motions, their clip values and prompts | extend | `apps/asset-pipeline/data/figures.json`, `data/prompts/` |
| The motions the core knows | extend | core `domain/Figure/motion.enum.ts` |
| Mirroring to front-right | exists (PIX-71) | the playground mirrors the whole figure at draw time; the asset layout stores no front-right |
| The office's draw functions for the check | exists (PIX-71) | `pnpm playground` |
| The steps and their checks | exists | skill `animate-figure` |
| Seated still for sit and type | new | the last frame of a sit-down clip |

## Placement

The frames are assets made by the pipeline's commands; a motion is data (`figures.json`, a prompt) plus its name in
the core's motion enum, so the figures' specs accept it; the steps are the skill `animate-figure`.

## Standards the build follows

- Rules: assets (motion only from the video model, a gesture defined before its first render, results checked
  through the office's own draw functions), workflow (one PNG before a visual is built), basis.
- One local render at a time under the memory guard, its progress streamed into the chat.

## Behavior

- **talk** (idle body with a speaking mouth): the body plays idle; the mouth switches between closed, half open and
  open in a speaking rhythm; no hand gesture. The half and open mouth states of M and F are drawn to match the closed
  mouth and go to the maintainer as one PNG first. Check: each state compared zoomed with the closed mouth and placed
  on every idle frame by the head origin.
- **wave** (loop): the near arm rises to shoulder height, the hand waves three times, the arm lowers; everything else
  as idle. Check: torso and legs within 1.5/255 of an idle frame.
- **sit** (loop on a seated still): sitting upright on an office chair, breathing and blinking as idle. The seated
  still comes from the last frame of a sit-down clip and goes to the maintainer as one PNG first.
- **type** (loop on the seated still at a desk): both forearms on the desk, fingers tapping, small head movements
  towards the screen. Check: back and legs still.
- Front-right of every animation, idle and walk included, is front-left mirrored.

## Test plan

- Per gesture: its check measured on every frame, the loop seam, consecutive frames overlaid at shoulders, hips and
  joints, every frame zoomed, in the room page at the pinned angles.
- Per gesture and figure: every layer combination of face, hair, garment and accessory placed on every frame.

## Out of scope

- Back views: their own card, because they double the drawing work.
- The further gestures (joy, scared, angry, sad, idea, thinking, jump, phone, point, drink, eat, stand up): each
  after these four, with its definition in the card first.
- Real-time blending between gestures.

## Changed on the way

- 2026-10-13, decided by the maintainer (sheet `pix58-hands`): F1 = a, talk is the idle body with drawn mouth states,
  not a clip; a hand gesture while speaking becomes its own motion later. F2 = a, the head track's ear limit is 2 px
  for every motion (33066ed). The talk candidates left the working tree and `figures.json`.
- 2026-10-13, measured: fingers melt in the video model wherever a hand moves fast, at 768 and at 1024 px alike
  (talk try 4 rendered at both sizes into a scratch folder); a still hand keeps them. The wave is rendered slowly
  (prompt says slowly, 97 frames) so the hand travels less per frame: M keeps its fingers in every frame. F's slow
  tries painted a face on the blank head (try 2) and swung the hand out of the clip (try 3); the cut now refuses a
  figure that leaves the clip, naming edge and frame, instead of failing in OpenCV (60d6e7a).
- 2026-10-13, measured: no wave so far meets its check "torso and legs within 1.5/255 of an idle frame": M's slow wave
  reaches 2.8 at the torso and 2.5 at the legs (the body follows the raised arm slightly), the fast try 3.4; the
  accepted idle stays within 1.3. The check was written before any wave was measured; the maintainer decides it.

- 2026-10-13, night: talk and wave for M and F rendered through the commands (8 clips, about 3.5 min each, one at a
  time under the guard). Talk try 1 froze, because its prompt said mostly what stays still; try 2 made one wide
  gesture (M's head turned 3.5 px, refused by the guard); try 3 made one small held gesture (M passes, F crouched and
  was refused). Candidates in the asset folder, uncommitted until the maintainer's verdict: M talk try 3, F talk try 2.
  The first wave track jumped 44 px: the ear was searched in the whole sprite and the raised arm's curve looked more
  like an ear; it is now searched within `earReach` (8 px) of where the head puts it (4ab91d4, idle and walk unchanged
  byte for byte). The waves still miss the 1 px ear limit by up to 0.68 px; the limit, talk and wave go to the
  maintainer on sheet `pix58-talk-wave`.

- 2026-10-13, decided by the maintainer (sheet `pix71-plan` F2 = a): the card joins the series branch and starts with
  talk and wave for M and F, rendered through the new commands one at a time under the guard and shown in the
  playground of PIX-71, which takes over the room page's part: the office's own draw functions. Talk is body only:
  its open and half mouth states do not exist yet, so the mouth part stays still. Sit, type and the mouth states wait
  for the maintainer; the seated still needs its PNG first.
- 2026-10-13, before the first render: talk and wave are rendered from the standing still with a blank face
  (`walk-start.png`, the walk's still), so the video model cannot move a face and the face parts follow by the head
  origin as in the walk; the head is tracked against `blank2.png` as in the walk. Front-right is the playground's
  mirroring of the whole figure (step 1, done by PIX-71). Wave gets 73 frames (3 s), since rising, three waves and
  lowering do not fit 2 s; talk gets 49 like idle.

- 2026-10-05 to 2026-10-09: swapping key drawings, a part rig of cut pixel parts, a figure LoRA (PIX-64), a 3D rig
  rendered as pixel art and parts turned with RotSprite were each measured and dropped; they broke the look or jumped
  between drawings. The reasons stand in ADR 0022 under Rejected.
- 2026-10-12: the card was rewritten to the video model after PIX-65 proved idle and walk with it; this plan follows
  the card and replaces the earlier plan of living drawings with a pop on change.
- 2026-10-13, decided by the maintainer: the setup (pipeline, rules, skills) moves into the repo under the hexagon
  first (PIX-66), and the gestures are then made through its commands, which tests the move. The card leaves the
  series of PIX-57 and waits for PIX-66. Step 1 was done in the scratchpad room page (version 54) and is repeated
  through the commands; the first talk clip of M stays as a reference only.

## Open questions

- **Decided by the maintainer:** the approval of this plan, given in chat on 2026-10-13 (approved, go ahead), before
  the first render of this card.
- **I decide:** the order of the gestures and the seed of each clip, because they follow from the definitions.

## Order

| Step | What | Check | Status |
| --- | --- | --- | --- |
| 1 | Front-right of idle and walk by mirroring, for M and F | both directions in the playground, zoomed | PIX-71 (`tileTransform.ts`; review run 1: mirrored equals flipped, 0 differing bytes) |
| 2 | talk for M and F: the half and open mouth states, then the idle body with a speaking mouth | one PNG of the mouth states, the maintainer's yes; the definition's check | redefined on sheet `pix58-hands` F1 = a; the clip candidates rejected |
| 3 | wave for M and F | the definition's check on every frame; the maintainer's verdict | rendered; ear limit and verdict on sheet `pix58-talk-wave` F1, F3; ear search fixed in 4ab91d4 |
| 4 | Seated still from a sit-down clip, for M and F | one PNG per figure, the maintainer's yes | open |
| 5 | sit for M and F | the definition's check on every frame; the maintainer's verdict | open |
| 6 | type for M and F | the definition's check on every frame; the maintainer's verdict | open |
| 7 | Every layer on every gesture by the head origin; front-right of every gesture | the full matrix in the room page | open |
