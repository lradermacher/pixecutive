---
name: implementation-plan
description: Turn one Jira card into the plan that the code skill builds — inventory of what exists, placement, steps that each end green, test plan, and the card's acceptance verbatim. Use when the maintainer orders the plan for a card. No code.
rules:
  - .claude/rules/workflow.md
  - .claude/rules/core.md
data:
  - .claude/data/ticket-types.tsv
gates:
  - scripts/ticket.ts
  - scripts/find-references.ts
---

# implementation-plan — from the card to the build plan

At the end `docs/plans/impl/PLAN_PIX-NNN_<short>.md` exists and carries every line of the card as a box, plus an
inventory that says for every part whether it exists, is extended or is new. Without it
[ticket.ts](../../../scripts/ticket.ts) opens no work package and the move to In Progress is rejected; the file name
is the pattern it searches for. The core question is what exists already: a second thing beside an existing one is
the most expensive outcome.

## Steps

1. **Read the whole card** — description and every comment; comments carry later decisions and override the
   description. *Done when the number of acceptance lines is known.*
2. **Open what the card names** — a mechanism the card points to is read, not judged from its title. A line that
   still looks wrong is asked about in the card, never argued away. *Done when every named place was open once.*
3. **Take the inventory** — the graph first when graphify is installed, then the code. What already solves a part,
   what is really missing, where it belongs by the placement criteria of the [core rule](../../rules/core.md), and
   which callers see the change. Every "nobody calls it" and every deletion carries the output of
   [find-references](../../../scripts/find-references.ts). *Done when every part says exists, extend or new, with
   its file.*
4. **Write the plan** — head with card key and goal, the acceptance list verbatim as `- [ ]`, inventory,
   placement, files touched, test plan, out of scope with reasons, open questions with who decides and why not me.
   *Done when plan and card have the same number of boxes.*
5. **Cut the order so every step ends green** — a table with step, what, check (the command that is green after
   it) and status (`open`, later the commit). No boxes in it: every box in the plan counts as an acceptance line.
   A gate is wired only after its probe turned red and green. *Done when every step has its check.*
6. **Get the maintainer's approval** — as a [decision sheet](../decision-sheet/SKILL.md); then the
   [code](../code/SKILL.md) skill takes over. *Done when the approval is recorded on the card.*

## Acceptance

- [ ] The acceptance list carries every line of the card verbatim as `- [ ]`
- [ ] Plan and card have the same number of acceptance lines
- [ ] Every part says exists, extend or new, with its file
- [ ] Every new part names the placement criterion that put it there
- [ ] The order is a table, every step with its check and status
- [ ] Every open question names who decides and why not me
- [ ] The maintainer's approval is recorded
