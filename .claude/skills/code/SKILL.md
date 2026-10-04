---
name: code
description: Build one approved Jira card: work package, the plan's order step by step, full gate, every card line ticked, independent review, pull request, Done after the merge. Use when the maintainer orders the build of a card; without an implementation plan nothing is built unless the card type is plan-free.
rules:
  - .claude/rules/workflow.md
  - .claude/rules/core.md
  - .claude/rules/ops.md
  - .claude/rules/basis.md
data:
  - .claude/data/ticket-types.tsv
gates:
  - scripts/ticket.ts
  - scripts/verify-full.ts
  - .claude/hooks/require-ticket.ts
  - .claude/hooks/guard-inprogress.ts
  - .claude/hooks/quality-guard.ts
  - .claude/hooks/gate-before-pr.ts
  - .claude/hooks/guard-done.ts
---

# code — from the approved card to the merged, accepted state

At the end the card stands on Done after the maintainer's merge, every acceptance line has its evidence (ticked in
the plan, or in a comment for a plan-free card), and an independent run in a fresh context has seen the diff. If one
of these is missing, the card is not "almost done" but open.

What applies while building stands in the rules and is followed here, not repeated: branch, commits, push and review
in [workflow](../../rules/workflow.md), the hexagon and where new code goes in [core](../../rules/core.md), gates and
tooling in [ops](../../rules/ops.md). The four stages and the card lifecycle are decided in
[ADR 0002](../../../docs/ADR/0002-feature-flow.md).

## Steps

1. **Read the whole card** — description and every comment through the Atlassian connector; where they disagree, the
   comments win. *Done when the card's acceptance list lies in front of you and you can count its lines.*
2. **Check the implementation plan** — it lies under [docs/plans/impl/](../../../docs/plans/impl/) and carries the
   card key in its name. Every open question in it names who decides; where that is missing, it is answered before
   anything is built. Plan-free is only a type that carries `no` in [ticket-types.tsv](../../data/ticket-types.tsv);
   then this step falls away. *Done when plan and card have the same number of acceptance lines, or the type is
   plan-free.*
3. **Set the work package** — on a branch `feat/pix-NNN-short` created from `main`, run
   `node scripts/ticket.ts open PIX-N --type <type> --title "<title>" --acceptance <n>` with type and title from the
   card and `n` its number of acceptance lines; [ticket.ts](../../../scripts/ticket.ts) rejects a type that
   [ticket-types.tsv](../../data/ticket-types.tsv) does not list. *Done when `node scripts/ticket.ts show` names the
   card.*
4. **Move the card to In Progress** — before the first commit, with the transition ID `tracker.transitions.inProgress`
   from the local config ([schema](../../../pixecutive.local.schema.json)).
   *Done when the transition went through; without a plan [guard-inprogress](../../hooks/guard-inprogress.ts)
   rejects it.*
5. **Build in the plan's order** — ask the graph first, as [ops](../../rules/ops.md) says, instead of reading many
   files. A step is done when the check of its row in the order is green,
   [quality-guard](../../hooks/quality-guard.ts) reported nothing on the files it wrote, and its evidence stands:
   the commit where something changed, otherwise the report or the output of the check. Then its status cell
   carries the evidence; a commit is entered by the commit of the next step, because no commit knows its own ID.
   The last build step enters its own status in its own commit; its evidence is the commit the review record lies
   on. After the last review, whose record the pull request carries, the plan does not change again, or the record
   no longer lies on the last commit. A done step is checked again only when a later commit changes its files.
   Whatever changes on the way goes into the card and into the plan, both. *Done when every row of the order
   carries its evidence.*
6. **Run the full gate** — `node scripts/verify-full.ts` ([verify-full](../../../scripts/verify-full.ts)) before
   the card is checked. *Done when it is green; a green gate measures the technique, not whether the card is
   fulfilled ([basis](../../rules/basis.md)).*
7. **Go through the card line by line** — each line verbatim, never summarized. A fulfilled line gets its box ticked
   in the plan with its evidence. A line that cannot be fulfilled is asked about in the card and stays open until
   it is answered; until then the card does not move on. A plan-free card has no boxes: the comment of step 10
   carries the evidence of its lines. *Done when `node scripts/ticket.ts boxes` reports no open box, or, for a
   plan-free card, every line has its evidence.*
8. **Get the independent review** — the agent [adversarial-review](../../agents/adversarial-review.md) in a fresh
   context, with card, branch and scope. The first run checks the card's whole diff against `main`, every further
   run only the commits since the last record; `node scripts/ticket.ts show` names both. Its report goes to the
   maintainer as a [decision sheet](../decision-sheet/SKILL.md), together with the order and its status. Every
   finding the maintainer keeps becomes a new row of the order and is built as in step 5: one about behavior is
   backed by a case in a probe or test, one about text by the diff. Record the run with
   `node scripts/ticket.ts review-done --findings <n>`; a third run needs the maintainer's yes, and ticket.ts
   rejects it without. Recording and `gh pr create` are two commands:
   [gate-before-pr](../../hooks/gate-before-pr.ts) judges the whole command before any part of it runs.
   *Done when the maintainer answered the sheet and the kept findings are fixed.*
9. **Hand the branch to the maintainer** — who checks it locally; only the maintainer's `/push` opens the window
   ([push](../push/SKILL.md)). Then the branch is pushed once and the pull request opened.
   *Done when the pull request exists.*
10. **Move the card to In Review with the pull request** — in a series already when the card is finished, because its
    pull request comes only with the last card. First a comment that names, per acceptance line, its evidence (file
    and line, a gate or a probe), every review with its record and report, and the pull request; then the
    transition `tracker.transitions.inReview`. Close the work package with `node scripts/ticket.ts close`; it leaves
    a closing record that the Done transition reads. *Done when the evidence comment stands, the card is on In Review
    and the package is closed.*
11. **After the maintainer's merge, move the card to Done** — the merge is the acceptance
    ([workflow](../../rules/workflow.md)); there is no question "move the card to Done?". A comment names the merged
    pull request, then the transition `tracker.transitions.done`; in a series, for every card of the pull request.
    The package need not be open: [guard-done](../../hooks/guard-done.ts) reads the closing record. Only without
    one, as on another machine, is the package set again with `node scripts/ticket.ts open` first.
    *Done when the card stands on Done.*

## Acceptance

- [ ] The card was read completely, description and comments
- [ ] The work package was set, and the branch carries the card key and starts from `main`
- [ ] The card stood on In Progress before the first commit
- [ ] Every row of the order carries its evidence
- [ ] What changed on the way stands in the card and in the plan
- [ ] `node scripts/verify-full.ts` is green
- [ ] Every acceptance line is ticked in the plan, or for a plan-free card backed in the comment
- [ ] `node scripts/ticket.ts boxes` reports no open box, where the card has a plan
- [ ] An independent run checked the diff, and its record lies on the head of the pull request
- [ ] The evidence per acceptance line stands in a comment on the card
- [ ] After the maintainer's merge the card stands on Done, without asking
