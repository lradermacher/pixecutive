---
name: pickup
description: At the start of a session without an order, read the board and propose exactly one card to work on, with the reason. Use when the maintainer says "what is next" or "continue", or a session starts without a concrete order.
rules:
  - .claude/rules/workflow.md
  - .claude/rules/basis.md
data:
  - .claude/data/ticket-types.tsv
  - pixecutive.local.schema.json
gates:
  - scripts/ticket.ts
---

# pickup — one card, not ten

At the end exactly one card is proposed, with one sentence why it is this one and what is different afterwards. A
list hands the decision back to the maintainer, which is what the board exists to spare them. An order of the
maintainer always wins; the board proposes, it never commands.

## Steps

1. **Run four queries** — through JQL on the project from the local config, statuses by their IDs: what is In
   Progress, what stands in To Do without `blocked`, what waits in In Review for the maintainer, what is `blocked`.
   *Done when all four results are there and none is unexpectedly empty.*
2. **Choose the card** — from To Do, the highest priority, then the oldest. Backlog is a proposal and no candidate;
   only the maintainer moves a card to To Do. *Done when exactly one card is chosen.*
3. **With no candidate, start nothing** — report what waits for the maintainer and what is blocked on what, and
   offer one or two Backlog cards as a question. *Done when the report stands and no card was invented.*
4. **Write the proposal** — card, labels, priority, why it, what is to be done, how to tell it is done, and in one
   sentence what else waits for the maintainer. *Done when the maintainer knows without asking what it is about.*
5. **Name the next step and stop** — the implementation plan, unless the card's type is plan-free in
   [ticket-types.tsv](../../data/ticket-types.tsv). Work starts only when the maintainer orders the card.
   *Done when the next step is named and nothing has started.*

## Acceptance

- [ ] All four queries ran, with status IDs from the local config
- [ ] The proposal names exactly one card from To Do, not `blocked`
- [ ] The proposal says how to tell the card is done
- [ ] What else waits for the maintainer or is blocked is named
- [ ] Nothing started before the maintainer ordered the card
