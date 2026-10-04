# Minimum CLI

[MIN_CLI](MIN_CLI) holds one line: the Claude Code version this setup was measured against. The session-start hook
compares the running CLI (`CLAUDE_CODE_EXECPATH`) with it and reports an older one, because a harness capability
that disappears does not fail loudly: a guard simply never turns red again.

## What the hooks rely on

Measured in the binary of CLI 2.1.288 and observed in a running session of it:

| Capability | Who needs it |
| --- | --- |
| `PreToolUse` with exit 2 blocking the tool call | require-ticket, protect-env, guard-shell, guard-state, gate-before-pr, guard-inprogress, guard-done, agent-guard |
| `PostToolUse` with exit 2 returning the findings | quality-guard, memory-guard |
| A `PreToolUse` matcher on an MCP tool name | guard-inprogress and guard-done on `mcp__atlassian__transitionJiraIssue` |
| `UserPromptSubmit` seeing the prompt text | push-window and unblock-window; without it the maintainer's `/push` and `/unblock` open nothing |
| `hookSpecificOutput.additionalContext` | rule-context injects the summary of an area's rule |
| `SessionStart` from every source, `compact` included | session-start resets the rule marker so area rules return after compaction |
| `SessionEnd`, not `Stop` | session-end; `Stop` fires after every turn |
| `CLAUDE_CODE_SESSION_ID` in the shell of a command | ticket.ts finds the state of its session |
| `CLAUDE_CODE_EXECPATH` | session-start compares the running CLI, not whatever `claude` is on the path |
| `permissions.disableBypassPermissionsMode` | settings.json; check-settings requires it |
| `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` | holds at most two agents at once (ADR 0017); check-settings requires it |
| `disable-model-invocation` in a skill | the push and unblock skills, which only the maintainer starts |

The version is the one measured against, not a proven floor; lowering it needs a measurement first. A change of the
line names here what was added and who needs it.
