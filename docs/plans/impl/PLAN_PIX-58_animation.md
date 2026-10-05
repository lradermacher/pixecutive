# PLAN PIX-58 — Animate the base figures the proven way: every gesture a living drawing with a pop on change

Card: PIX-58 (feature), first card of the series PIX-58 → PIX-59 → PIX-57 on `feat/pix-7-skeleton-toolchain`, one
pull request at the end. Goal, decided on sheet `pix64-lora-base` F1 (2026-10-05): the gestures of M and F work the
proven way of the reference project. Every gesture is its own drawing from the approved base, alive with the approved
idle values; a side motion only where it holds; a short pop on change. Real in-between frames come back as a later
card; the three failed tries are recorded below.

## Acceptance

- [ ] Every gesture of the list is its own drawing from the approved base, for M and for F, living with the approved idle values
- [ ] Changing gestures plays a short pop, then the new pose lives on
- [ ] Side motions run only where they hold: the waving forearm, nod and head shake
- [ ] Each gesture is stored as its drawing's parts plus one JSON with its rig values
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

- The hybrid failed on the proof (2026-10-05): the M wave from five drawings jumped at every swap, because every
  drawing of the image model differs a little (face, hair color, shirt shading, proportions, head 4–19 px apart).
  The maintainer chose a part rig from one master drawing instead (sheet `pix58-rig-method` F1): the figure is drawn
  once in an open pose with every limb visible, approved as one PNG, cut once into head, torso, upper arms,
  forearms, hands and legs with overlap caps at the joints, and every gesture only turns and moves these parts. What
  a rotation cannot reach (hand shapes, held objects, face expressions) is a small part drawn once and swapped on its
  part. Key drawings per gesture are no longer made; the strip line of the acceptance is met by the master and the
  swap parts a gesture needs.

- The part rig failed too (2026-10-05, rejected by the maintainer as unusable): rotating cut pixel-art parts by
  30–110 degrees turns pixel edges into torn stairs, the forearm floats off the hidden upper arm, and the A-pose master
  gave a splayed stance. Only living poses (one drawing, bends under 10 degrees) work. The maintainer chose to test a
  figure LoRA first (sheet `pix58-anim-next` F1, card PIX-64): if it keeps redrawn frames consistent, gestures become
  short frame sequences of real drawings. The card is blocked until PIX-64 has a verdict; the approved living poses stay
  the asset meanwhile.

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
| 1 | Hybrid key drawings for the wave | the maintainer's yes on the strips | done, then rejected in motion; kept as record |
| 2 | Part rig from one master drawing | the maintainer's verdict | rejected; kept as record |
| 3 | Open defects of the living poses: stand-up redrawn as standing up, the typing forearm moving, stray pixels of F jump | pinned frames looked at | done: crumbs removed in every part; the stand-up redraw failed (figure stood on the chair) and the typing arms lie behind the laptop, so no forearm can be cut; both go to the maintainer on the sheets |
| 4 | Nod and head shake through the head rig, as their own entries on the sheets | pinned frames looked at | done: entries `nod` and `shake`, frames looked at |
| 5 | Each gesture's parts and rig values stored as one JSON per gesture | the files exist for every gesture of M and F | done: `renders/base-<figure>/gestures/`, 19 JSON per figure |
| 6 | Both motion sheets rebuilt and approved with a verdict per gesture | every gesture approved | open |
