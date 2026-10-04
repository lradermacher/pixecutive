---
name: ticket
description: Create, read, maintain or close a Jira card on PIX so that it outlives the session. Use before anything is written through the Atlassian connector and at every status change.
rules:
  - .claude/rules/workflow.md
  - .claude/rules/basis.md
data:
  - .claude/data/ticket-types.tsv
  - pixecutive.local.schema.json
gates:
  - scripts/ticket.ts
  - .claude/hooks/guard-inprogress.ts
  - .claude/hooks/guard-done.ts
---

# ticket — the card that outlives the session

At the end a card stands that a later session can work from without asking: what is to happen, where, and how to
tell it is done. What stands only in the chat is lost. The lifecycle of a card is decided in
[ADR 0002](../../../docs/ADR/0002-feature-flow.md); the site, project, status, transition and type IDs come from
`tracker` in the local config described by [its schema](../../../pixecutive.local.schema.json), never from memory
and never from this repo.

## Steps

1. **Search before creating** — a card of a running feature belongs to its epic, which almost always exists. JQL
   addresses statuses by ID from the local config; a status name returns nothing once it is renamed.
   *Done when the target epic is found, or its absence is shown by the search.*
2. **Write the card** — the title says what is to happen. The description: base branch (`main`, or the series
   branch its epic names), what it is about in one to three sentences, where (file, area), and an acceptance list
   with one line per requirement. *Done when the card names its base branch and every requirement is a line.*
3. **Set `parent` and the label on creation** — type Epic, Task or Bug from the IDs in the local config, a `typ:`
   label from [ticket-types.tsv](../../data/ticket-types.tsv), status Backlog. *Done when both stand from the
   first save.*
4. **Read description and comments; write decisions back** — comments override the description, and what changes
   the state also goes into description and title. *Done when a stranger reads today's state from the card alone.*
5. **Move to In Progress before the first commit** — [guard-inprogress](../../hooks/guard-inprogress.ts) rejects
   it while the implementation plan is missing. *Done when the transition went through.*
6. **Maintain the card while working** — a deviation or assumption becomes a comment when it happens; a card
   waiting on something gets the label `blocked` and a comment naming what it waits for. *Done when no state
   stands only in the chat.*
7. **A finding outside the card becomes its own card** — in the Backlog, instead of stretching the scope.
   *Done when the finding has a key or is rejected with a reason.*
8. **In Review while its pull request waits; Done after the merge** — with a comment that names the evidence per
   acceptance line. [guard-done](../../hooks/guard-done.ts) rejects Done while a box is open. A card closed without
   doing goes to Won't Do with its reason. *Done when the evidence comment stands and the card is Done.*

## Acceptance

- [ ] An existing epic was searched for before a new one was created
- [ ] The title says what is to happen, and the card carries an acceptance list
- [ ] `parent`, type and `typ:` label stood from creation on
- [ ] The card was In Progress before the first commit
- [ ] Every deviation and assumption stands as a comment on the card
- [ ] Done carries evidence per acceptance line; Won't Do carries its reason
