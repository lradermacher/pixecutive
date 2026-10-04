# apps/server — the server of one company instance

## Purpose

Runs one company: it wires the core to its adapters, serves the clients over HTTP and WebSocket, and runs the AI employees that work on a person's own API key.

## Owner

**App**

## Never here

⛔ Domain rules: the core.
⛔ Talking to a database or a remote service directly: an adapter in `packages/infrastructure`.

## Entry point

`src/index.ts` — the composition root of the server.
