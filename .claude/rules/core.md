---
paths:
  - "packages/**"
  - "apps/server/**"
  - "apps/client/**"
adr: docs/ADR/0011-hexagonal-architecture.md
summary: >
  Hexagonal: the core imports no framework, no infrastructure, no app. Ports are domain-typed interfaces, adapters map
  at the edge, time and IDs come from ports and adapters. Configuration enters at the app, secrets fail closed,
  subscription logins are never read. The browser UI never imports the core. Changes carry their tests; comments say
  why.
---

# Core — the hexagon

## The hexagon's boundaries are never crossed
`packages/core` imports no framework, no `@pixecutive/infrastructure`, no app and no IO module.
`[Lint import zones · Hook architecture-guard]`

## A port is a domain-typed interface; an adapter maps at the edge
`port/outgoing/<name>.interface.ts` exports `I<Name>`; adapters map with `toDomain`, and no persistence record leaves
the infrastructure package. A token file exists only where a container binds the port.

## Time comes through a clock port, IDs from adapters
The core never calls `new Date()` or generates tokens itself.

## Errors are core exceptions with a key, translated at each edge
HTTP, WebSocket and CLI each translate the same exception into their own answer.

## Configuration enters at the app, secrets fail closed
The core reads no environment; apps validate configuration with a core schema; a missing secret stops the start.

## Subscription logins are never read by Pixecutive
Only the provider's official CLI touches them; Pixecutive starts the CLI and reads its output.

## The browser UI never imports the core
The wire contract between UI, client and server lives in `packages/protocol`.

## Where new code goes
Touches the outside world (files, network, processes, databases, CLIs): an adapter. Decides without touching it: domain
or application. Wires ports to adapters: the app. Crosses the wire: the protocol package.

## A change carries its tests
Unit tests in the touched package. Green on the type check is not a test.

## A comment says why the code is the way it is, never how it got there
No date, no name, no ticket as history, no retrospective, no commented-out code. `[Gate check-comments]`

## `.env` is never touched
Neither read nor written, copied or overwritten. `[Hook protect-env · Hook guard-shell]`
