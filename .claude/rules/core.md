---
paths:
  - "packages/*"
  - "apps/company-server/**"
  - "apps/companion/**"
  - "apps/asset-pipeline/**"
adr: docs/ADR/0011-hexagonal-architecture.md
summary: >
  Hexagonal: the core imports no framework, no infrastructure, no app. Ports are domain-typed interfaces, adapters map
  at the edge and throw only keyed core exceptions, edges translate keys by typed tables. Time and IDs come from
  outside the core. Configuration is parsed by a schema at start, secrets fail closed. The browser UI never imports
  the core. Changes carry tests.
---

# Core — the hexagon

## The hexagon's boundaries are never crossed
`packages/core` imports no framework, no `@pixecutive/infrastructure`, no app and no IO module.
`[Lint import zones · Hook architecture-guard]`

## A port is a domain-typed interface; an adapter maps at the edge
`port/outgoing/<name>.interface.ts` exports `I<Name>`; adapters map with `toDomain`, and no persistence record leaves
the infrastructure package. A token file exists only where a container binds the port.
`[Lint import zones · Agent adversarial-review]`

## Time comes through a clock port, IDs from adapters
The core never calls `new Date()` or `performance.now()`, and never draws a random ID or token itself.
`[Lint no-restricted-syntax Date · Lint no-restricted-syntax random]`

## Errors are core exceptions with a key, translated at each edge
HTTP, WebSocket and CLI each translate the same exception through a typed table from key to answer, so a key without
an answer does not compile. `[Lint no-restricted-syntax throw Error · Gate verify-full: type check]`

## An adapter turns every outside failure into a core exception with a key
A failed process, a refused request or a missing file never leaves the infrastructure package as a plain `Error`.
`[Lint no-restricted-syntax throw Error · Agent adversarial-review]`

## Configuration enters at the app, secrets fail closed
The core reads no environment; apps parse configuration with a core schema at start. A default exists only for a value
that is not a secret; a failed parse stops the start.
`[Lint import zones · Agent adversarial-review]`

## Subscription logins are never read by Pixecutive
Only the provider's official CLI touches them; Pixecutive starts the CLI and reads its output.
`[Agent adversarial-review]`

## The browser UI never imports the core
The wire contract between UI, client and server lives in `packages/protocol`. `[Lint import zones]`

## Where new code goes
Touches the outside world (files, network, processes, databases, CLIs): an adapter. Decides without touching it: domain
or application. Wires ports to adapters: the app. Crosses the wire: the protocol package. `[Agent adversarial-review]`

## Files follow one hexagon naming pattern
`domain/<Aggregate>/` in PascalCase holds camelCase files with a type suffix: `.interface.ts`, `.enum.ts`, `.schema.ts`.
Services are `application/service/<name>.service.ts`, exceptions `<aggregate>.exception.ts` with
`<aggregate>ExceptionKey.enum.ts` with keys `<aggregate>.<snake_key>`, adapters
`adapter/<Area>/<port>-<technology>.adapter.ts` exporting `<Port><Technology>Adapter`, command line entry points
`src/cli/<verb><Noun>.handler.ts`. Zod is the core's one library.
`[Lint import zones · Agent adversarial-review]`

## A change carries its tests
Unit tests in the touched package. Green on the type check is not a test.
`[Gate check-tests · Agent adversarial-review]`

## A comment says why the code is the way it is, never how it got there
No date, no name, no ticket as history, no retrospective, no commented-out code. `[Gate check-comments]`

## `.env` is never touched
Neither read nor written, copied or overwritten. `[Hook protect-env · Hook guard-shell]`
