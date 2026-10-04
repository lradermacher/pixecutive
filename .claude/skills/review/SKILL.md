---
name: review
description: Check and judge in two modes — with a diff against its card and the rules, ending in mergeable or not; without a diff as a scan over a named area, ending in a report on a decision sheet. Use when the maintainer orders a review. Fixes only what the maintainer orders.
rules:
  - .claude/rules/workflow.md
  - .claude/rules/basis.md
  - .claude/rules/core.md
  - .claude/rules/ops.md
data: []
gates:
  - scripts/ticket.ts
  - scripts/rules-for.ts
  - scripts/verify-full.ts
  - scripts/find-references.ts
  - .claude/hooks/quality-guard.ts
---

# review — from a diff or an area to a backed verdict

At the end stands a verdict. **With a diff** it opens with the acceptance count and closes with one sentence:
mergeable or not. **Without a diff** it is a report over a named area that the maintainer receives as a decision
sheet. Every finding carries `file:line`, the measurement that backs it, and an outcome.

Missing code produces no findings: what is not there has no line number. That is why, with a diff, the verdict on the
card comes before the verdict on the code. What is looked for stands in [basis](../../rules/basis.md),
[core](../../rules/core.md) and [ops](../../rules/ops.md); which of them apply to a file,
[rules-for](../../../scripts/rules-for.ts) says. The checks on every write run in
[quality-guard](../../hooks/quality-guard.ts) and are read here, not repeated.

This is **not** the independent review before a pull request; that one is the agent
[adversarial-review](../../agents/adversarial-review.md), run from step 8 of the [code](../code/SKILL.md) skill.

## Steps

### With a diff — the verdict on a card

1. **Fetch card and plan** — the card through the Atlassian connector with its comments, and the implementation plan
   with its key. *Done when you know the number of acceptance lines.*
2. **Count the open boxes** — `node scripts/ticket.ts boxes PIX-N`. Open means not done.
   *Done when the number of open boxes is known.*
3. **Hold the plan against the card** — does the plan carry every line of the card, or did one get lost in copying?
   The script counts the boxes; the coverage is yours to check. *Done when every card line is found in the plan.*
4. **Hold every tick against the diff** — for every ticked box, find the change that fulfills it. Where none exists,
   the tick is uncovered, and that is a blocker ([workflow](../../rules/workflow.md)).
   *Done when every tick has its place in the diff or is noted as uncovered.*
5. **Read the diff** — for connections, ask the graph first, as [ops](../../rules/ops.md) says.
   *Done when every changed file was open once.*
6. **Run the gate** — `node scripts/verify-full.ts` ([verify-full](../../../scripts/verify-full.ts)).
   *Done when its result stands in the verdict, green or red.*
7. **Write the verdict** — first line: how many acceptance lines are fulfilled, and which are not. Then the findings,
   sorted blocker, should, nice to have. Last sentence: mergeable or not.
   *Done when a reader without the diff knows what to do.*

### Without a diff — the scan over an area

1. **Present the scope and wait** — the file list, the layer of each file from
   [ADR 0011](../../../docs/ADR/0011-hexagonal-architecture.md), the rules that follow from it, what stays out and
   what is compared against. Reading starts only after the maintainer's yes: a scan without a diff has no boundary
   that stops it by itself, and a misunderstood boundary is the most expensive finding of the run.
   *Done when the scope is confirmed.*
2. **Go file by file** — each file of the scope is opened once, checked against every rule
   [rules-for](../../../scripts/rules-for.ts) names for its path, and ticked off in a list
   ([workflow](../../rules/workflow.md)). Unsure means "to be checked", not blocker.
   *Done when every file of the scope is ticked.*
3. **Hold message shapes against their schema** — where the scope touches what crosses the wire, the zod schema of the
   protocol package ([ADR 0011](../../../docs/ADR/0011-hexagonal-architecture.md)) lies beside it. A field without
   a schema disappears on parsing, and nothing turns red.
   *Done when every touched message shape has seen its schema.*
4. **Hold what callers see against `main`** — signatures, enums, routes and message schemas in the scope against
   their state on `main`. A removed enum value or a field less stays green and breaks only at the caller; name the
   callers with [find-references](../../../scripts/find-references.ts).
   *Done when every changed public shape is unchanged or its callers are named.*
5. **Give every finding its outcome** — source and measurement first, then the proposal: fixed in the current order
   and named in the commit, or a new card ([workflow](../../rules/workflow.md)). A finding a running gate should have
   caught is reported as a hole in that gate ([ops](../../rules/ops.md)).
   *Done when every finding has a backing and a proposed outcome.*
6. **Send the report as a decision sheet** — through the [decision-sheet](../decision-sheet/SKILL.md) skill; in the
   chat stand only the count per severity and the blockers. A whole report in the chat is not read, and after the
   session it is gone. *Done when the sheet is published and the short version names the blockers.*

## Acceptance

- [ ] With a diff: the verdict opens with "n of m acceptance lines fulfilled" and names the open ones
- [ ] With a diff: every ticked line of the card is found in the diff or reported as uncovered
- [ ] Without a diff: the scope was confirmed before the first file was read
- [ ] Without a diff: every file of the scope was opened once and ticked off
- [ ] Without a diff: the report went out as a decision sheet, the chat carries only the short version
- [ ] Every finding carries `file:line`, its measurement and an outcome
- [ ] The findings are sorted blocker, should, nice to have
- [ ] What a running gate should have caught is reported as a hole in that gate
- [ ] The gate result stands in the verdict, even when it is green
- [ ] Nothing was fixed that the maintainer did not order
