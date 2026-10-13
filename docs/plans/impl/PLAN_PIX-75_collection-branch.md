# PLAN PIX-75 — Record in ADR 0024 that a series collects on one branch with a draft pull request until its milestone can be shown

Card: PIX-75 (setup), on the collection branch `feat/pix-7-skeleton-toolchain` after PIX-73; ordered by the
maintainer on sheet `collection-branch` (F1 = a, F2 = a, F3 = yes) on 2026-10-13. Goal: the next session knows from
the repo that nothing goes to main before a milestone can be shown, and that this series ends with M1.

## Acceptance

- [x] ADR 0024 states that a series runs on one branch with a draft pull request until its milestone can be shown, and is then merged once — `docs/ADR/0024-a-series-collects-until-its-milestone-can-be-shown.md` points 1 and 2
- [x] ADR 0024 names M1 as the milestone that ends the current series, with sheet `collection-branch` as its source — point 6 and "Chosen"
- [x] ADR 0002 point 3 and ADR 0004 point 1 point to ADR 0024 for when a series ends, in the way the ADR README prescribes — `superseded-by` with the point named in a comment in both, `supersedes: [2, 4]` with its comment in ADR 0024; the state tables are regenerated
- [x] The workflow rule on series says the same in one line, and check-rules is green — `.claude/rules/workflow.md` "A series collects on its branch until its milestone can be shown"; check-rules green in verify-full
- [x] Finished cards of a collecting series stay In Review until the milestone merge, and the rule or ADR says so — ADR 0024 point 4 and the workflow rule

## Inventory

| Part | State | File |
| --- | --- | --- |
| A series shares one branch and one pull request | exists | ADR 0002 point 3, ADR 0004 point 1, `.claude/rules/workflow.md` ("Cards go through a session one after another") |
| When a series ends | new | `docs/ADR/0024-a-series-collects-until-its-milestone-can-be-shown.md` |
| Partial supersede with a comment | exists as a pattern | `docs/ADR/README.md` ("When the new ADR replaces only some points"); ADR 0004 already carries `superseded-by: 20 # app names only` |
| State tables | exists | `scripts/generate-adr-state.ts` (reads a list of successors with a comment) |
| Milestones | exists | `docs/plans/PLAN_PRODUCT.md` ("Each milestone is one epic and can be shown on its own"; M1) |
| CI on a draft pull request | exists, unchanged | `.github/workflows/ci.yml` (`on: pull_request`) |

## Placement

A way of working is an ADR of kind `workflow` plus one line in the workflow rule (ADR 0001: one carrier per rule).
ADR 0002 and ADR 0004 are on main, so they are not edited but superseded in the one point: their frontmatter gets
the comment form the README prescribes, and their point text stays.

## Behavior

- ADR 0024 decides:
  1. A series collects on its branch, with its pull request as a draft, until the milestone it belongs to can be
     shown. `[Prose: whether a milestone can be shown is the maintainer's judgment]`
  2. It is then merged once, by the maintainer. `[Hook guard-state]`
  3. Every card on the branch still gets its own plan, review and local check.
     `[Gate ticket open · Agent adversarial-review]`
  4. Finished cards stay In Review until that merge and then go to Done together. `[Hook guard-done]`
  5. CI measures every push through the draft. `[Config ci.yml]`
- The current series ends with M1 "Walk through your own office" (sheet `collection-branch` F2 = a).
- The ADR also names the rejected option, a separate integration branch with one pull request per card (F1 b).
- ADR 0002 gets `superseded-by: 24 # the end of a series in point 3 only; the rest of this ADR stands`.
- ADR 0004 gets `superseded-by: [20, 24]`, with a comment that names both: the app names for 20, and the end of a
  series in point 1 for 24.
- The workflow rule's series heading gets one sentence with the ADR's carrier.

## Test plan

- `node scripts/generate-adr-state.ts` writes the three tables, and pre-commit accepts them.
- `node scripts/check-docs.ts --all`, `check-carriers.ts --all` and `check-rules.ts --all` are green; the rule
  budget stays under its limit.
- `node scripts/verify-full.ts` is green.

## Order

| Step | What | Check | Status |
| --- | --- | --- | --- |
| 1 | ADR 0024, the two frontmatter comments, the state tables, the README index if it lists ADRs, the workflow rule line; tick the five lines | check-docs, check-carriers, check-rules green; verify-full green | done; its commit carries the review record |

## Out of scope

- The GitHub ruleset that enforces squash merges: that is PIX-9.
- The rename of the series branch: its name carries PIX-7. The branch hook accepts it, and renaming would cost the
  open PR #2.

## Open questions

None: sheet `collection-branch` decided branch, end and record.
