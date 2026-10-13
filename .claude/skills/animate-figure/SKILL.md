---
name: animate-figure
description: Make one motion of a figure (a walk, an idle or a gesture) from its approved still with the local video model, cut into a cycle or closed as a loop, and checked frame by frame before the maintainer sees it. Use for every new or changed figure animation.
rules:
  - .claude/rules/assets.md
  - .claude/rules/workflow.md
data: []
gates: []
---

# animate-figure — one motion the maintainer accepted in the office player

At the end a motion of one figure plays in the office player: a cycle that repeats without a jump, or a loop that
closes on its own still. It does what its definition in the card says, measured, and the maintainer accepted it
there. Why motion comes from the video model, and drawn states only where it melts, is decided in
[ADR 0022](../../../docs/ADR/0022-assets-are-drawn-from-our-own-templates-and-checked-by-eye.md).

## Steps

1. **Define the motion** — what moves, what stays still, the timing, and the measurement that is checked before it
   is shown, on a [decision sheet](../decision-sheet/SKILL.md). *Done when the definition stands in the card with
   the maintainer's yes.*
2. **Choose the mode** — `cycle` for a motion that repeats a stride (walk, run): a free clip, one cycle cut out of it.
   `loop` for a motion on the spot (idle, wave, sit, type): the same approved still anchors the first and the last
   frame, so the loop closes and the figure cannot drift. A pose that is not standing gets its own sprite `height` in
   the figures' data file, chosen so its head scale matches the standing motions. *Done when the mode stands in the
   card.*
3. **Write the prompt** — it states how little moves and what stays still, in the definition's words. A word that
   turns the body, a head motion next to a blink, or a shifting weight each start a motion nobody asked for. Name a
   side by the picture (the arm on the right side of the picture), and ask for slow movement: fast hands melt.
   *Done when every sentence of the prompt maps to a line of the definition.*
4. **Render one clip** — `pnpm assets clip <figure> <motion>` renders it from the approved still the figures' data
   file names, one job at a time under the memory guard, its progress streamed into the chat. *Done when the clip
   exists.*
5. **Cut the frames** — `pnpm assets frames <figure> <motion>`: a cycle is cut where the stride repeats, each unique
   pose kept with its hold; a loop keeps its frames between the anchors. What the video model cannot move without
   melting it (a speaking mouth, typing fingers) comes as drawn states by the skill
   [figure-part](../figure-part/SKILL.md): mouth states are face parts on every motion, finger states are named under
   the motion's `hands` and painted into its sprites by this command. `pnpm assets track <figure> <motion>` places
   the head per frame and refuses a track whose ear strays; `pnpm assets export <figure> <motion>` writes the sprites,
   the face parts and the manifest into the office's asset folder. *Done when the frame set plays without a jump in
   the player.*
6. **Check before showing** — a contact sheet; the definition's measurement per frame; the seam of the loop; every
   frame zoomed; consecutive frames overlaid at shoulders, hips and joints; in the office player at the pinned
   angles, never in a re-implementation of it. *Done when every check is measured and passed.*
7. **Show it and stop** — the motion in the player and the contact sheet, zoomed. *Done when the maintainer
   accepted it, or named what is wrong; then the step it points to starts again.*

## Acceptance

- [ ] The definition stood in the card with the maintainer's yes before the first render
- [ ] The clip was rendered from the approved still, one job at a time under the memory guard
- [ ] No part was stretched, rotated or moved by code
- [ ] Every frame was looked at zoomed, overlaid with its neighbor, and measured against the definition
- [ ] The motion was checked in the office player, not in a re-implementation
- [ ] The maintainer accepted the motion in the player
