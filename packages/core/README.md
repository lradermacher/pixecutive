# packages/core — the domain, its use cases and its ports

## Purpose

Holds what Pixecutive decides without touching the outside world: the office, people, AI employees, runs and assets as domain types, the use cases on them, and the outgoing ports their adapters implement.

## Owner

**Core**

## Never here

⛔ A framework, a database client, a CLI or any IO module: an adapter in `packages/infrastructure`.
⛔ Wiring of ports to adapters: an app under `apps/`.
⛔ Message shapes for the wire: `packages/protocol`.

## Entry point

`src/index.ts` — the public surface of the core; every app imports the core only through it.
