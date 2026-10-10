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

- Walking was approved on 2026-10-05: a stride pose (one image-model render from the approved base, the approved head
  put back by the nose) alternates with the approved idle as the passing moment, four steps per second with a small
  lift, while the figure moves across the floor. The opposite step and a separate passing pose came back identical in
  four renders and are not pursued.

- A 3D detour followed (2026-10-05): the CC0 Human Base Meshes body and then its jointed stylized figure, rigged with
  the CC0 Quaternius Universal Animation Library, moved cleanly in walk and idle, but every way of giving it the
  drawing's look (flat shading bands, UV paint, projecting the drawing) read as a blurry 3D render. Research found no public
  pipeline that gets characters looking like hand-drawn pixel art of this size from a pure render. The maintainer chose 2.5D (sheet
  `pix58-look-path-20261005`): the figure is drawn once as pixel-art parts in layers with overlapping round joints,
  only the joint angles per frame come from the animation library, the parts are turned with Aseprite's RotSprite
  (the rotation that broke the earlier part rig was an ordinary image filter), and walk keeps 6 to 8 frames. Faces
  are drawn parts per direction, switched per expression. Aseprite is compiled locally from source and stays a
  local tool; the steps the repo runs are Python.

- The turned-parts walk broke in motion (torn outlines, joint gaps), so the bare walk follows the approved walk
  instead (2026-10-05, accepted by the maintainer): each frame is made in one step from an approved dressed frame
  (only the clothes removed), all frames share one head and upper body pixel for pixel, the limbs are aligned onto it,
  and consecutive frames are checked overlaid before they are shown. The order agreed with the maintainer: source file
  with walk and idle (step 10), the modularity proof with one top, one hairstyle, face parts and color swaps on walk
  and idle (PIX-59), then every gesture of M (step 11), the character editor mockup (PIX-60), then F, then office assets.

- The edges are fixed by fixed ramps, not by a new method (2026-10-06, accepted by the maintainer): the approved
  drawing held 3063 colors, near-black alone in dozens of shades, which put noise on every edge. A style sheet fixes
  one ramp per material (outline 1, skin 5, hair 4, shorts 3, white 1); every pixel is snapped to its material's
  ramp, 14 colors per frame, and recolor swaps a ramp. The walk keeps the approved head (the redrawn bare head lost
  character). A second try at rendering the body from the CC0 rig, as an outside research suggested, was rejected
  again: the realistic library body read as a 3D render, and our own stylized base would first need a full model
  that matches the drawing. The 2D way stays: parts redrawn only where an action moves them.

- Restart on one straight line (2026-10-09, agreed with the maintainer): the maintainer set aside the earlier fixed
  values (155 px, the drawn M) and gave a new art style, two ChatGPT sheets of chunky figures in the HD office pixel
  style (large head, thick dark outline, soft cel shading). Measured on the way and dropped: a 64 px figure built from
  shapes and a 3D toy figure on the CC0 walk rig were consistent across frames but far below the style (at 80 px the
  reference holds 17,323 colors and designed forms, the toy 23 colors and primitive shapes); the local edit model
  keeps the style of its first image but ignored a pose given as an image or as a keypoint map; Z-Image Turbo with the
  pose ControlNet follows a keypoint map (passed straight to the model, since its own detector finds no person on a
  toy figure) but cannot take the style without training. The ChatGPT sheets themselves are composited from part
  layers in one single pose, so they solve neither modular parts nor animation. The line: (1) template of the base
  figures M and F, bald, in underwear, with a default face, rebuilt locally from the ChatGPT figures; (2) 15 to 20
  training images from the template in poses and views; (3) a style LoRA on Z-Image Turbo; (4) base frames idle and
  walk front-left from the rig's keypoints, plus the head with a blank face; (5) the first parts drawn onto those
  frames by the edit model and cut out as layers by their difference to the base: face parts (eyes, brows, nose,
  mouth, once per direction since the head is one image per direction), one hairstyle, top, trousers, shoes;
  (6) a combination test of two by two parts in the walk. Every step ends with one PNG and the maintainer's yes; a
  failed step stops the line and goes to the maintainer. Until step 6: no Blender modeling, no own pixel drawings,
  no further tools.

## Decided

- **Asset layout:** the maintainer approved parts plus a timeline (sheet `pix57-animation-approach` B1), so the layout
  of PIX-57 gains `animations/<action>/<direction>.json` next to the part images; PIX-57 writes it into its layout
  gate with the rewrite.
- **Evidence of this card:** its code reaches the repo with PIX-57; the evidence per acceptance line is the approved
  strips and motion sheets plus the timeline files, and the review of the series checks the rewritten code.
- **A definition before every gesture:** the maintainer decided (sheet `pix58-idle-definition` F2, 2026-10-10) that
  every gesture gets a definition in the card before its first render: what moves, what stays still, its timing, and
  the measurement checked before it is shown.
- **Idle:** (same sheet, F1 = b) the figure stands still, with head, legs and arms in place; chest and shoulders rise
  and fall barely visibly with the breath; a short blink, eyes closed for 3 frames (about 0.13 s), every 3 to 6 s at
  random; no nod, no head turn. Checked before it is shown: the head outside the eye band differs from a calm frame
  by at most 1.5 of 255 in every frame (a nod measured 6 to 8.7; the head's top edge did not catch it), the leg spread
  is constant, and a blink starts only from a calm frame within 0.6 of the blink frames.

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
| 6 | Both motion sheets rebuilt and approved with a verdict per gesture | every gesture approved | done: approved by the maintainer on 2026-10-05; stand-up and the typing hands accepted as they are |
| 7 | Walking of M front-left from the stride pose and the idle | the maintainer's yes | done: approved, sheet `pix58-walk-floor2` |
| 8 | RotSprite test: one drawn arm part in five angles at sprite size | the maintainer's verdict on one PNG | done: tested; turned parts broke in motion and were dropped for the walk |
| 9 | Bare walk of M from first-generation frames with one shared upper body, built in Aseprite | the maintainer's yes in the player | done: accepted on 2026-10-05 |
| 10 | Source file `m.aseprite`: walk and idle with the approved head, one layer per material (body, hair, shorts), the style ramps as palette | the maintainer's yes in the artifact; the export matches the checked frames pixel for pixel | done: accepted on 2026-10-06; export differs in 0 pixels, 14 colors per frame |
| 11 | Every approved gesture of M made bare the same way and added as a tag | overlay check per gesture, the maintainer's yes | in progress: face parts (brows, eyes, nose, mouth, ear) on their own layers, talk with three mouth states, blink, and wave with raise and lower over two in-between poses, accepted on 2026-10-06; sit and type open; stopped by the restart of 2026-10-09 |
| 12 | Template: base figures M and F, bald, in underwear, default face, rebuilt locally from the ChatGPT figures | the maintainer's yes on one PNG | done: approved on 2026-10-09 (PIX-65 comment 14014), the two ChatGPT sheets as they are |
| 13 | 15 to 20 training images from the template in poses and views | each image checked side by side against the template; the maintainer's yes on the set | done: the approved sheets are the training set, 24 images (PIX-65 comment 14014) |
| 14 | Style LoRA on Z-Image Turbo | one test image next to the template; the maintainer's yes | done: `pxofc-v2` approved on 2026-10-09 (PIX-65 comment 14015) |
| 15 | Base frames idle (1) and walk (4) front-left from the rig's keypoints, plus the head with a blank face | proportions measured against the template; overlay check; the maintainer's yes | done: made by the local video model instead of keypoints; walk accepted and idle accepted on 2026-10-10 (PIX-65 comments 14017, 14021) |
| 16 | First parts on the base frames, cut out as layers: face parts, one hairstyle, top, trousers, shoes | each part checked across all frames; the maintainer's yes per part | in progress: the hoodie on the 16 walk frames of M (PIX-65 comment 14018) |
| 17 | Combination test: two by two parts in the walk | overlay check; the maintainer's yes | open |
