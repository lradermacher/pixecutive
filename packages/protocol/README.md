# packages/protocol — the messages between browser, client and server

## Purpose

Defines the shape of every message that crosses a wire, so the browser UI can speak with client and server without importing the core.

## Owner

**Contract**

## Never here

⛔ Domain rules or use cases: the core.
⛔ Sending or receiving messages: an adapter or an app.

## Entry point

`src/index.ts` — the schemas every side validates against.
