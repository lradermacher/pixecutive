---
name: comment-audit
description: Run the comment rule set of ADR 0005 over every existing file, put the counts per area on the cleanup card and clear the areas one by one. Use when existing comments are to be cleaned up or someone asks how large the backlog is — not for single files, which the gate checks on every write anyway.
rules:
  - .claude/rules/core.md
  - .claude/rules/workflow.md
data: []
gates:
  - scripts/check-comments.ts
  - scripts/probe-check-comments.sh
---

# comment-audit — the pass over everything that exists

At the end the cleanup card carries, per area, the number of findings, the densest file and one acceptance line, and
every cleared area has no finding left. What a comment may carry where is decided in
[ADR 0005](../../../docs/ADR/0005-code-documentation.md); the gate on every write, pre-commit and this pass all run
the same [check-comments](../../../scripts/check-comments.ts). This skill holds no rule of its own.

## Steps

1. **Prove the gate** — `bash scripts/probe-check-comments.sh`
   ([probe](../../../scripts/probe-check-comments.sh)) turns every prohibition red once and green once.
   *Done when the probe is green; otherwise the gate is repaired first, not the backlog counted.*
2. **Count the backlog** — `node scripts/check-comments.ts --all` over everything the gate covers, the gates
   themselves included; its findings are grouped by area, one area per top-level folder or package. *Done when the
   run is through and per area the count, the kinds of finding and the densest
   file are known.*
3. **Put the counts on the cleanup card** — search the open card on the comment backlog with JQL
   (`project = PIX AND summary ~ "comment backlog" AND statusCategory != Done`); only when none exists, create one
   with the [ticket](../ticket/SKILL.md) skill. On it, per area one line with count, kinds and densest file, and one
   acceptance line per area, so the card can be accepted in pieces. No checked-in list of hits: the run is the
   source. *Done when the card carries count and acceptance line per area.*
4. **Clear area by area** — once the maintainer orders the card, through the [code](../code/SKILL.md) skill. Each
   finding gets one of three answers from ADR 0005: what carries an architecture decision becomes an ADR; what the
   caller must know stays as JSDoc; everything else is deleted. No third place is created. A long block may be a
   function contract: its length reports, it does not decide.
   *Done when `node scripts/check-comments.ts` on the files of the area reports nothing.*
5. **Report the state back to the card** — the area's acceptance line, with the run as its evidence.
   *Done when every ticked line names a green run.*

## Acceptance

- [ ] The probe was green before anything was counted
- [ ] The counts stand per area on the one existing cleanup card, not on a second one and not in the repo
- [ ] Every finding became an ADR, JSDoc or a deletion; nothing moved to a third place
- [ ] The clearing ran under the cleanup card's work package
- [ ] Every ticked area has a green run as its evidence
