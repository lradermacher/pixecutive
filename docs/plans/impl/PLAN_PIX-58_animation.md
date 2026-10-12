# PLAN PIX-58 — Animate the base figures from the video model: talk, wave, sit and type

Card: PIX-58 (feature), built after PIX-66 on its own branch from `main`, through the asset pipeline's commands. Goal:
the base figures M and F talk, wave, sit and type in the office the way idle and walk were made in PIX-65, each motion
made by the local video model from the approved still, defined before its first render and accepted by the
maintainer. Decided on sheet `pix57-clean-branch` F7 and F8 (2026-10-12).

## Acceptance

- [ ] Talk, wave, sit and type exist for M and F front-left, each made by the video model from the approved still
- [ ] Each gesture's definition stands in this card before its first render, and its check is measured before it is shown
- [ ] Front-right exists for every animation by mirroring
- [ ] Every face, hair, garment and accessory layer follows each gesture by the per-frame head origin
- [ ] Every gesture is checked in the room page, frames overlaid and zoomed at the joints, before the maintainer sees it
- [ ] The maintainer approves each gesture with a verdict

## Inventory

| Part | State | File |
| --- | --- | --- |
| Approved stills of M and F with a blank face | exists, outside the repo until PIX-66 | session scratchpad, `renders/` |
| Video clip in `cycle` or `loop` mode, frame cut, unique poses with holds | exists, outside the repo until PIX-66 | session scratchpad pipeline |
| Per-frame placement of face, hair, garment and accessory layers by the head origin | exists, outside the repo until PIX-66 | session scratchpad export |
| Room page with the office's draw functions | exists, outside the repo until PIX-66 | session scratchpad |
| One video render at a time under the memory guard (pressure level and swap, like `pnpm assets render` for images) | exists, outside the repo until PIX-66 | session scratchpad `anim.sh` |
| The steps and their checks | exists | skill `animate-figure` |
| Mirroring to front-right | new | the export of the pipeline |
| Seated still for sit and type | new | the last frame of a sit-down clip |

## Placement

The frames are assets made by the pipeline; the steps are the skill `animate-figure`; a tool the pipeline needs
arrives in the repo as an adapter behind a core port with PIX-66 (ADR 0019). Nothing in this card is code in the repo
before PIX-66.

## Standards the build follows

- Rules: assets (motion only from the video model, a gesture defined before its first render, results checked
  through the office's own draw functions), workflow (one PNG before a visual is built), basis.
- One local render at a time under the memory guard, its progress streamed into the chat.

## Behavior

- **talk** (loop): standing as in idle; the mouth opens and closes in a speaking rhythm; small hand gestures at waist
  height; no step. Check: feet constant, head top within 2 px.
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
| 1 | Front-right of idle and walk by mirroring, for M and F | both directions in the room page, zoomed | open |
| 2 | talk for M and F | the definition's check on every frame; the maintainer's verdict | open |
| 3 | wave for M and F | the definition's check on every frame; the maintainer's verdict | open |
| 4 | Seated still from a sit-down clip, for M and F | one PNG per figure, the maintainer's yes | open |
| 5 | sit for M and F | the definition's check on every frame; the maintainer's verdict | open |
| 6 | type for M and F | the definition's check on every frame; the maintainer's verdict | open |
| 7 | Every layer on every gesture by the head origin; front-right of every gesture | the full matrix in the room page | open |
