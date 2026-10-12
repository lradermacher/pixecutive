# packages/infrastructure — the adapters behind the core's ports

## Purpose

Implements the outgoing ports of the core against the outside world: database, files, processes, provider CLIs, local models and remote services. It maps every outside record to a domain type at its edge.

## Owner

**Adapter**

## Never here

⛔ A decision that does not need the outside world: the core.
⛔ Reading configuration or the environment: the app that wires the adapter.
⛔ A persistence record crossing into the core: map it with `toDomain` here.

## Entry point

`src/index.ts` — the adapters an app may wire.
