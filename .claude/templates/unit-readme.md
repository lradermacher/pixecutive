# <path> — <half a sentence: what this unit is>

## Purpose

Two to four lines: which problem this unit solves, for whom. Not what it contains; why it exists.

## Owner

Exactly one of: **Core** (domain, use cases, ports) · **Adapter** (talks to the outside world) · **App** (wires ports
to adapters) · **Contract** (crosses the wire) · **Tooling** (scripts, hooks, gates around the repo).

## Never here

⛔ The most important section: the boundary to the neighbor, not a repetition of the house rules. One to three points,
each with the place where the thing belongs instead.

## Entry point

`path/to/file.ts` — half a sentence on why this is the first file someone opens.

<!--
TEMPLATE for the README of every unit (a folder under apps/ or packages/ with its own package.json).
  - At most 40 lines including these headings. The four headings stand in exactly this order and wording.
  - The first sentence under `## Purpose` goes into the generated index.

EXCLUDED, does not belong in a unit README:
  ⛔ the house rules              → .claude/rules/, linked at most
  ⛔ decisions and their reasons  → an ADR
  ⛔ a file list or a changelog   → the code and git
-->
