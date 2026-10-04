---
paths: # The files this rule applies to. EMPTY means always loaded, always paid for.
  - "<glob>"
adr: <docs/ADR/NNNN-….md> # The ADR that decided this rule. Required.
summary: >
  <At most 60 words. Injected on the first write in this area: not the rule, but its shortest true sentence.>
---

# <Area>

## <The rule as a statement in the heading>

<The rule: present tense, checkable, no gallery of examples. When it has a mechanism, it stands in brackets:
`[Lint <rule>]` `[Hook <name>]` `[Gate <name>]`.>

<!--
EXCLUDED, does not belong in a rule:
  ⛔ steps in an order      → a skill
  ⛔ collections of examples → the code itself is the example
  ⛔ derivation, trade-offs  → the ADR named in `adr:`
A rule without `paths:` counts against the permanent context budget measured by check-rules (ADR 0001).
-->
