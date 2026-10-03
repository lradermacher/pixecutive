---
name: <kebab-case, English; the folder has the same name>
description: <What the skill does AND when it applies. One sentence that makes sense without the skill's name. At most 300 characters: it sits in every system prompt.>
rules: [] # rules whose rules apply here: linked, never repeated
data: [] # data files the steps read
gates: [] # scripts and gates the steps call
---

<!--
⛔ READ FIRST WHEN YOU REWRITE AN EXISTING SKILL:
The new version is written from THIS TEMPLATE, not sorted from the old skill. Sorting the old text line by line gives
a tidier old skill at best, never the version the purpose needs. The purpose is always the same: someone opens the
skill and can do the task right without reading anything else and without guessing.

⛔ THEN, FOR EVERY RULE AND EVERY LESSON THAT STOOD IN THE OLD SKILL:
Check first whether it already lives elsewhere: a rule, an ADR, a hook, a lint or a data file. If it does, it becomes
a link. If it lives NOWHERE else, it is not dropped: stop and ask the maintainer what happens to it.
-->

# <name> — <half a sentence: what comes out at the end>

<Two to four lines: the result, not the procedure. Whoever reads the skill must know how to tell it is done.>

## Steps

1. **<Action>** — <what it produces, and how you see that the step is done>
2. **<Action>** — …

## Acceptance

- [ ] <checkable, not "worked carefully">
- [ ] <checkable>

<!--
EXCLUDED, does not belong in a skill:
  ⛔ rules that can be broken          → a rule, linked through `rules:`
  ⛔ data sets (lists, bands, sets)    → a data file, linked through `data:`
  ⛔ history ("on YYYY-MM-DD …")       → the card or an ADR
  ⛔ a path as a code span as a link   → a Markdown link or a frontmatter field
A skill with zero steps is not a skill.

WHAT THE GATE DOES NOT MEAN, two cases where it is deliberately silent:
  · `data: []` is an EMPTY list, not a path.
  · A code span with < > * ? is a PLACEHOLDER, not a link: `packages/<name>/` names no file that could exist.

⛔ NO `when:` field. The trigger lives in `description`; a second field for it would be a second truth.
Measured by `check-skills` once the skill is listed in `.claude/data/skill-conformance.tsv`; EVERY skill needs a row.
-->
