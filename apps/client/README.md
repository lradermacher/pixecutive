# apps/client — the local client a person starts with npx

## Purpose

Runs on a person's machine: it serves the browser UI, connects to the company server, and runs the AI employees that work on the person's own subscription through the provider's official CLI.

## Owner

**App**

## Never here

⛔ Domain rules: the core.
⛔ Drawing the office: `apps/web`.
⛔ Reading or storing a subscription login: only the provider's CLI touches it.

## Entry point

`src/index.ts` — the composition root of the client.
