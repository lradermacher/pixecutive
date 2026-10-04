---
name: unblock
description: The maintainer's named escape from the work-package rule. Opens 45 minutes in which writes to protected paths pass without a package, each reporting the reason. Only the maintainer types it, always with a reason.
disable-model-invocation: true
rules:
  - .claude/rules/workflow.md
data:
  - .claude/data/protected-paths.txt
gates:
  - scripts/ticket.ts
---

# unblock — a visible, timed way around the work-package rule

At the end, writes to protected paths pass for 45 minutes without a work package, and every one of them reports the
reason, so nobody forgets the window is open. It moves the moment the card is written; it never removes the card.
The trade-off stands in [ADR 0003](../../../docs/ADR/0003-no-write-without-ticket.md).

## Steps

1. **The maintainer types the line with a reason** — `/unblock <reason>`; without a reason nothing opens.
   *Done when the line carries a reason.*
2. **The hook opens the window** — [unblock-window](../../hooks/unblock-window.ts) records it through
   [ticket.ts](../../../scripts/ticket.ts); the same call from a shell command is rejected by `guard-state`.
   *Done when it reports the window and the reason.*
3. **Work with the reason in view** — every write to a path from
   [protected-paths.txt](../../data/protected-paths.txt) reports it. *Done when the work the window was opened for
   is done.*
4. **Write the card afterwards** — what was built in the window gets its card. *Done when the card is on the board.*

## Acceptance

- [ ] The line came from the maintainer and carried a reason
- [ ] The reason appeared with every write in the open window
- [ ] What was built in the window has a card
