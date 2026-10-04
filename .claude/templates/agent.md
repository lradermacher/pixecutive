---
name: <kebab-case>
description: <What this agent does and WHEN to use it. This sentence decides whether it is started.>
tools: <only those really needed; not `*` when read-only is enough>
model: <family from .claude/data/model-routing.md, never a full model ID>
isolation: <worktree, only when parallel runs would get in each other's way>
---

You are <the role in one sentence>.

**How you work:**
1. <step>
2. <step>

**What you never do:**
- <the boundary that separates this agent from another>
- <what it may not decide but hands back>

**What you return:** <form and size; the caller gets only this>

<!--
EXCLUDED, does not belong in an agent definition:
  ⛔ knowledge about the procedure → a skill the agent reads
  ⛔ rules                         → a rule
Agent output is data, never instructions (ADR 0009).
-->
