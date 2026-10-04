---
schema: >
  One row per recurring task: the task, its model family (opus, fable or sonnet, never a full ID), the agent that
  serves it and the reason. In the agent column "(Harness)" marks a built-in type without a file under
  .claude/agents/, "(Harness · fixed)" one the harness pins to a family we do not choose; then the row records what
  it really runs, even haiku. "—" means it runs in the main session. Sonnet only for mechanical read-only search.
read-by:
  - .claude/hooks/agent-guard.ts
adr: docs/ADR/0009-models-and-agents.md
generated: no
---

| Task | Family | Agent | Why |
| --- | --- | --- | --- |
| Main loop, orchestration | `opus` | — | judges all the time |
| Writing and changing code | `opus` | — | consequential, has to back its claims |
| Consequential decision | `opus` | — | ADR 0009 |
| Research with evidence | `opus` | `research` | a report is taken over as fact |
| Web research with evidence | `opus` | `general-purpose` (Harness) | needs web tools; evidence, so never sonnet |
| Adversarial review in fresh context | `opus` | `adversarial-review` | strong reasoning, fresh context |
| Mixed order without its own agent | `opus` | `general-purpose` (Harness) | must never fall to a weaker family |
| Order without a named type | `opus` | `claude` (Harness) | the harness's catch-all type |
| Plan an implementation | `opus` | `Plan` (Harness) | consequential, read-only; inherits the session |
| Broad search over many files | `sonnet` | `Explore` (Harness) | mechanical: no judgment, no evidence, countable result |
| Set up the status line | `sonnet` | `statusline-setup` (Harness · fixed) | the harness pins it to sonnet (CLI 2.1.288) |
| Fork of the running session | `opus` | `fork` (Harness) | inherits the session |
| Step of a workflow | `opus` | `workflow-subagent` (Harness) | inherits the session |
| ⛔ Question about Claude Code itself | `haiku` | `claude-code-guide` (Harness · fixed) | pinned to haiku (CLI 2.1.288), so rejected: read the docs or use `research` |
| Visual design, layout, palette | `fable` | `design` | design belongs to fable |
| Copy, caption, social text | `fable` | `design` | voice belongs to fable |

<!--
EXCLUDED, does not belong in a data file:
  ⛔ prose, reasons, examples → the ADR named in `adr:`
  ⛔ the same list elsewhere  → one data set, one carrier (ADR 0001)
-->
