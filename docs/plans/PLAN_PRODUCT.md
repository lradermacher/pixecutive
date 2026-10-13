# Product plan — from an empty office to a company that builds Pixecutive in Pixecutive

Stage 1 of the feature flow (ADR 0002): what is built and why, not how. Once the cards exist, the cards are the
requirement and this plan is not maintained any more.

## Goal

The first company in Pixecutive is the one that builds Pixecutive. The goal is the smallest product with which that
company develops its own product inside the office: people and AI employees in one walkable pixel office, working on
real tickets of this repo, visible to everyone. Everything after that is built by that company in Pixecutive.

The problem that disappears: today the work of AI agents happens in terminals nobody else sees, on one person's
machine, without a shared picture of who works on what.

## Sources

- The maintainer's vision of 2026-10-03 (the office is the whole interface; one instance per company; a local client
  per person started with `npx`; own subscription locally, API key on the server; Claude Code first, then Codex; Jira,
  GitHub/GitLab, mail and webhooks as inputs; 2D isometric pixel art made in Blender).
- ADR 0011 (hexagon: `packages/core`, `packages/infrastructure`, `packages/protocol`, `apps/company-server`, `apps/companion`,
  `apps/office-ui` outside the hexagon) and ADR 0012 (AI employees, runs, two compute sources, one runtime port).
- The maintainer's requirements on runs of 2026-10-03: who sent an AI employee, with which source, AI and task;
  nobody controls every AI employee; local runs pause when the device goes offline.
- Server stack fixed by the maintainer: NestJS, PostgreSQL, TypeORM.
- Game UI: spikes PIX-11 to PIX-14 decide the renderer; large windows are HTML over the canvas; characters are a base
  male or female body with configurable layers, furniture can be recolored.

## Scope, as milestones

Each milestone is one epic and can be shown on its own.

### M1 — Walk through your own office
One room on the local machine: a character, walking by click, furniture, and one object that opens a window. No
server, no accounts. It proves the renderer, the window pattern and the asset pipeline end to end.

### M2 — A company with people in it
The server of a company instance, accounts, the CEO's onboarding with their own character, departments that appear
as rooms, inviting people, and everyone seeing everyone move on the same map in real time. Roles and permissions are
a real model from the first story on: every action checks a permission, roles are sets of permissions, and owner and
member are only the first two roles (maintainer, 2026-10-04: adding this later would be a pain).

### M3 — Hire AI employees
An AI employee with a role, its own Markdown files and a desk. A person sends it to a task on their own subscription
(Claude Code on their device, through the official CLI) or on their own API key (on the server). There is no company
API key: a person may store their own key, and only runs that person starts use it (maintainer, 2026-10-04). This
replaces the company key of ADR 0012 point 3 and needs its own ADR before the runtime is built. Clicking it shows
who sent it, with which source, AI and model, and on which task. Access is given, not assumed; a local run pauses
while its device is offline. The personal assistant who guides the first steps is the first AI employee.

### M4 — Work on real tickets
Jira as the ticket system: tickets open as windows over desks and boards, and everyone sees which human or AI employee
works on which ticket. GitHub as the code host: branches and pull requests of a run are visible. Chat between people
and AI employees, and artifacts of a run shown in the office.

### M5 — The company builds Pixecutive in Pixecutive
The maintainer's company runs its own instance, works on this repo's tickets inside the office, and from here on new
work on Pixecutive is done through Pixecutive. This milestone is the goal of this plan.

### After M5, not planned in detail
Codex as the second runtime; GitLab; mail (Gmail or an own server) and webhooks (Sentry, CI) as sources of tasks;
the character editor with special outfits; an asset viewer that shows every asset with its textures and colors
(the asset manifest carries layers, color slots and texture variants as data from the start, so it stays possible);
more providers.

## Out of scope, with reasons

- **Billing, plans, hosting as a service:** the project is open source and not about earning money; hosting may be
  offered later, never required (ops rule).
- **Providers other than Claude Code before M5:** one runtime adapter proves the port; the vision names Codex second.
- **Mobile clients:** the client is a web UI started by `npx` on a desktop.
- **Our own ticket system:** the vision says Jira is used, not rebuilt.
- **Storing or proxying subscription logins:** forbidden by the providers' terms and ADR 0012 point 8.
- **Supporting weak hardware:** performance is measured on the maintainer's machines.

## Open questions

Each goes onto the decision sheet with a recommendation; the cards follow the answers.

Answered on the story-map sheet, 2026-10-04:

1. M5 is the goal; M1 to M5 in order.
2. Owner and member as the first roles, invitation by link, email and password; roles and permissions as a model from
   the start.
3. A paused run keeps its task; it never moves to another source by itself; there is no company API key, a person's
   own key serves only that person's runs; "allowed to use" is granted per person per AI employee in M3, per
   department after M5; no budgets before M5.
4. Decided by ADR 0011, not asked: Jira and GitHub sit behind their own ports with one adapter each.

## Test approach

Every story names its acceptance lines; the core is tested with in-memory fakes (ADR 0011), the edges with their own
tests, and every milestone ends with a demo the maintainer can walk through on their machine.
