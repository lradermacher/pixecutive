---
name: plan
description: Turn an order of the maintainer into a product plan and its Jira cards — what is built and why, not how. Use when the maintainer orders a product plan. Ends with the cards created; the plan is done then.
rules:
  - .claude/rules/workflow.md
  - .claude/rules/core.md
data:
  - .claude/data/ticket-types.tsv
gates: []
---

# plan — from an order to the cards

At the end, cards stand in the Backlog, each with its own acceptance list, and a plan document that has served its
purpose. From the first card on, the card is the accepted requirement and the plan is not maintained any more. This
stage answers what and why; the how belongs in the implementation plan per card
([ADR 0002](../../../docs/ADR/0002-feature-flow.md)).

## Steps

1. **Understand the order** — what does not block the plan is decided and explained, the rest goes out as a
   [decision sheet](../decision-sheet/SKILL.md). *Done when one sentence says which problem disappears.*
2. **Ask the code, do not guess** — the graph first when graphify is installed, then the files. Every assumption of
   the plan gets a source. *Done when no assumption stands without one.*
3. **Cut the scope** — goal, the parts of the hexagon it touches, the data it needs, and explicitly what is out of
   scope, each point with its reason. *Done when every excluded point has a sentence why.*
4. **Write the plan** — under [docs/plans/](../../../docs/plans/) as `PLAN_<NAME>.md`: goal, scope, out of scope, open questions, test
   approach. No file list and no order of steps; that is the next stage. *Done when a reader knows without you
   what is built and what is not.*
5. **Create the cards** — through the [ticket](../ticket/SKILL.md) skill: epic first, every card with `parent`,
   a `typ:` label from [ticket-types.tsv](../../data/ticket-types.tsv) and an acceptance list. *Done when every
   card stands in the Backlog with its epic.*
6. **Get the maintainer's answer** — go or changes, as a sheet. The next step per card is its implementation plan,
   never the build. *Done when the answer is there.*

## Acceptance

- [ ] Every assumption of the plan has a source in the code or a document
- [ ] Out of scope names a reason for every point
- [ ] The plan holds no file list and no order of steps
- [ ] Every card carries its epic, its `typ:` label and an acceptance list, and starts in the Backlog
- [ ] The maintainer's go or changes are recorded
