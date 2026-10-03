---
adr: docs/ADR/0001-one-carrier-per-rule.md
summary: >
  Applies everywhere: everything in the repo is English, no any, real data instead of stubs. No assumptions: what is
  not measured is not claimed, and versions are measured before they are proposed. Nothing names the private repo or
  other projects. A criterion decides where new things go. Memory never holds a rule, and nothing is deleted without
  the maintainer's yes.
---

# Basis — what applies in every area

## Everything in the repo is English
Code, identifiers, file names, comments, docs, rules, skills, commits, tickets and pull requests. Identifiers consist
of English words or allowed technical terms. `[Hook quality-guard · Gate check-english]`

## No any, no string union, one export per file
Strict TypeScript. A set of values is an `enum` in compiled product code and a frozen `as const` object with a derived
type in hooks and gates, which Node runs directly and cannot run enums. A file that exports several values carries a
marker with the reason. `[Lint · Config tsconfig erasableSyntaxOnly · Gate check-one-export]`

## Every function uses its arguments and returns real data
A test checks real code, never a stub.

## No assumptions
What is not measured is not claimed, and what cannot be measured is asked. A sentence in an existing file counts
only once it is checked. A tool, a version or a compatibility is measured in the same session before it is proposed.

## What an outside source defines is fetched from there
Brand colors, logos, legal texts, API signatures, tool versions: the bytes come from the source.

## Nothing in this repo names, links or reads the private repo or another project of the maintainer
Rules state the rule itself; private values come from the local config. `[Gate history guard denylist]`

## A criterion decides where new things go, not the most convenient place
The placement criteria in the core rule decide; if none applies, ask.

## A lesson is written in the same session, names its cause and becomes concrete
"Marker was missing" is a symptom; the cause is what also hits the next five cases.

## Never invent work to look busy
Having nothing to do is a finding: report it and groom the backlog.

## A rename is done only when the old name is gone everywhere
Folders, frontmatter, links with their labels, headings, data rows, probes and hook configuration.
`[Gate check-skills reference]`

## A green run is not a yes
A gate says that nothing measurable is broken, not that the thing works. The verdict comes from the maintainer or a
measurement, never from an exit code.

## Memory holds incidents, preferences, project state and pointers, never a rule
A stale statement in docs or memory is corrected in passing. `[Hook memory-guard · Gate check-memory]`

## Nothing is deleted without the maintainer's yes, per file
A gate may report a file as overdue; only the maintainer removes it. The question goes on a decision sheet, with the
output of `find-references` as evidence. `[Gate find-references · Skill decision-sheet]`
