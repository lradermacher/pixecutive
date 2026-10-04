---
name: decision-sheet
description: Build a decision sheet for the maintainer as an interactive artifact — findings with sources, only real questions with my own recommendation, answers collected in its store. Use whenever input, an approval or a decision from the maintainer is needed, instead of asking in chat.
rules:
  - .claude/rules/workflow.md
  - .claude/rules/basis.md
data:
  - .claude/skills/decision-sheet/sheet-template.html
gates: []
---

# decision-sheet — findings in, one sheet out on which the maintainer only decides

At the end a published sheet stands that reads on a phone as well as on a desktop: on top the items that really
need the maintainer, each with a finding, my recommendation and the reason; below, collapsed, what is already
decided. Answers land in a collection that is read before anything is carried out. The shape comes from
[sheet-template.html](sheet-template.html), styled with the tokens of the Pixecutive design system; general page
craft comes from the built-in `artifact-design` skill. Why questions go out this way is decided in
[ADR 0002](../../../docs/ADR/0002-feature-flow.md).

## Steps

1. **Back the findings** — read the affected files in full first. Every item names its source: file and line, a
   measurement or a card. A finding from an agent is checked at its source before it is used; every "nobody calls
   it" and every deletion proposal carries the output of [find-references](../../../scripts/find-references.ts).
   *Done when every item carries a source or stands explicitly as an open question.*
2. **Separate what is the maintainer's call** — ask only about deleting (per file), a new rule, a convention, a
   contradiction between two of their decisions or with an ADR, money, law or public visibility. Everything else
   is decided and explained. *Done when every question carries "I would" and "Why", and none is one I can answer.*
3. **Build the sheet from the template** — copy [sheet-template.html](sheet-template.html) into the scratchpad and
   fill only the head, `ITEMS`, `ASK`, `AFTER` and `COLLECTION`. Questions are `F1`, `F2` …, decided items
   `B1`, `B2` …; `COLLECTION` is unique per sheet. A choice between options gets `options` with one `rec: true`,
   otherwise it is Yes / Other; a correction to a decided item goes into the note of a question.
   *Done when no template placeholder is left.*
4. **Check before publishing** — count opening and closing tags of `div`, `p`, `ol`, `h1`, `h2`, `section` and
   `script`, then render at 390 px width: no horizontal scroll, no script error, and look at the screenshot
   yourself. *Done when the counts match and the screenshot has been seen.*
5. **Publish and check the collection** — as an artifact with the `db` capability (editors write, viewers read),
   then read the collection once. The maintainer gets the link and, in one or two sentences, what waits for them.
   Never republish while the maintainer may be filling it in. *Done when the collection is reachable.*
6. **Read the answers, then carry them out** — "Other" with a note is the decision, not the proposal. Every
   decision goes into the card and the plan, and into an ADR where it shapes the project.
   *Done when every answer is carried out or stands open on the card.*

## Acceptance

- [ ] Every question to the maintainer went through the sheet, none as chat text
- [ ] Every item carries a source or stands as an open question
- [ ] Every question carries my own recommendation with a reason
- [ ] Only the maintainer's calls were asked; the rest stands decided for reference
- [ ] Tags match, and the sheet was rendered at 390 px and looked at
- [ ] The answers were read before carrying them out, and each is in the card and the plan
