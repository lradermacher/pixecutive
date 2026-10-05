# PLAN PIX-58 — Animate the base figures: every gesture as a keyframed sequence

Card: PIX-58 (feature), first card of the series PIX-58 → PIX-59 → PIX-57 on `feat/pix-7-skeleton-toolchain`, one
pull request at the end. Goal: every gesture of the base figures M and F runs as a real animation, start → peak →
back. Method decided on the sheet `pix57-animation-approach` (2026-10-05):
1. A cutout rig moves the parts (upper arm, forearm, hand, head, torso) along keyframed curves with easing,
   anticipation and overshoot, at 60 fps.
2. The image model draws only the key drawings whose silhouette no part can be turned into, 2–3 per gesture.
3. A drawing swap happens at the fastest moment of the motion.

## Acceptance

- [ ] M wave is built first as the proof: idle → arm rises → three waves → arm lowers → idle, about 3 s, and is approved by the maintainer before any other gesture is built
- [ ] The key drawings of each gesture are approved as one PNG strip before the gesture is animated
- [ ] Every gesture of the list runs as a keyframed sequence for M and for F
- [ ] Each gesture is stored as part PNGs plus one JSON timeline (part, time, angle, offset, easing, drawing swap)
- [ ] Every motion is checked in the real player at pinned times, zoomed at every joint, before the maintainer sees it
- [ ] The maintainer approves every gesture on a motion sheet with a verdict per gesture

## Inventory

| Part | State | File |
| --- | --- | --- |
| Approved base drawings M and F, 17 living poses each | exists | `renders/base-m/`, `renders/base-f/` (gitignored) |
| Pose rig: cutout, head mesh, one moving limb, lids | exists, outside the repo until PIX-57 | session scratchpad |
| Elbow cap and rigid forearm swing, lids from eye glints | exists, outside the repo until PIX-57 | session scratchpad |
| Motion sheet builder in the project's branding | exists, outside the repo until PIX-57 | session scratchpad |
| Parts split further: upper arm, forearm with hand, torso, head | new | rig step, outside the repo until PIX-57 |
| Timeline format (part, time, angle, offset, easing, drawing swap) and its player | new | player step; its schema moves into the core with PIX-57 |
| Key drawings per gesture | new | `renders/base-<figure>/keys/` (gitignored) |
| Pinned-angle check of the real player | exists, outside the repo until PIX-57 | session scratchpad |

## Placement

- **Why outside the repo first:** the maintainer ordered the two proofs (this card's wave, the modular PNG of PIX-59)
  before the setup (sheet `pix57-full-pipeline` F2). The chain is rewritten into `apps/asset-pipeline` under the
  hexagon by PIX-57 (ADR 0019): the timeline schema and the easing math into the core, the image model and the
  file work into adapters, the commands into the app.
- **Renders stay out of git** until the catalog card decides what ships (sheet `pix57-full-pipeline` B2).

## Standards the build follows

- **Look before showing:** every key drawing and every motion is looked at first; motion in the real player at
  pinned times, zoomed at every joint (lesson of 2026-10-05).
- **One render at a time** under the memory guard (rule assets).
- **A visual is agreed as one PNG before it is built** (rule workflow).

## Behavior

- **Key drawings:** per gesture the image model redraws the approved base into the 2–3 silhouettes the rig cannot
  reach; they are cut out like the poses and shown as one strip.
- **Timeline:** per gesture one JSON file lists for each part its keys (time, angle, offset, easing) and the moments
  where the drawing is swapped.
- **Player:** reads the timeline, bends nothing that is rigid (forearm turns at the elbow under the body's cap),
  swaps drawings at the fastest moment, loops back into the idle.

## Test plan

- **Pinned frames:** each gesture rendered by the real player at fixed times, zoomed at every joint, looked at.
- **The maintainer:** one motion sheet per figure with a verdict per gesture.
- **Unit tests** for the timeline schema and easing come with the rewrite in PIX-57.

## Out of scope

- **Walking and the back views:** their own round after the proof, same method.
- **Modular parts and colors:** PIX-59.
- **The repo rewrite, skill, rule and ADR:** PIX-57.

## Changed on the way

## Decided

- **Asset layout:** the maintainer approved parts plus a timeline (sheet `pix57-animation-approach` B1), so the layout
  of PIX-57 gains `animations/<action>/<direction>.json` next to the part images; PIX-57 writes it into its layout
  gate with the rewrite.
- **Evidence of this card:** its code reaches the repo with PIX-57; the evidence per acceptance line is the approved
  strips and motion sheets plus the timeline files, and the review of the series checks the rewritten code.

## Open questions

None.

## Order

| Step | What | Check | Status |
| --- | --- | --- | --- |
| 1 | Key drawings of M wave rendered and shown as one PNG strip | the maintainer's yes on the strip | open |
| 2 | Arm split into upper arm and forearm with hand; timeline format and player | pinned frames of a test timeline, looked at | open |
| 3 | M wave as a full sequence on a motion sheet | pinned frames looked at; the maintainer's yes | open |
| 4 | Remaining gestures of M: strip, then sequence, one by one | the maintainer's yes per strip; pinned frames | open |
| 5 | All gestures of F the same way | the maintainer's yes per strip; pinned frames | open |
| 6 | Motion sheets M and F with a verdict per gesture | every gesture approved on the sheets | open |
