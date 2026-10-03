# Pixecutive — Claude guide

Pixecutive is a shared, walkable pixel office in which people and AI employees work together as a company. Open
source (MIT), one instance per company, a local client per person started with `npx`.

## Where the rules are

Every rule lives in `.claude/rules/` and only there. `basis` and `workflow` are always loaded; `core` and `ops` load
through their `paths:` when a file of their area is opened, and a hook injects their summary on the first write.
What a rule is and where it belongs: [ADR 0001](docs/ADR/0001-one-carrier-per-rule.md).

## Authoritative documents

1. [docs/ADR/](docs/ADR/README.md): the decisions. An ADR is never deleted, only superseded.
2. [.claude/rules/](.claude/rules/): the rules.
3. [.claude/SKILLS.md](.claude/SKILLS.md): the skills, generated from their frontmatter.

Exactly this list is authoritative. Everything under `docs/plans/` and `docs/research/` is raw material.

## How a feature is built

Four stages, enforced: product plan (`plan`) → Jira cards (`ticket`) → one implementation plan per card
(`implementation-plan`) → `code`. From stage 2 on, the card is the accepted requirement.
[ADR 0002](docs/ADR/0002-feature-flow.md).

## Tasks live in Jira

Project `PIX`; the site and all IDs come from the local config, never from this repo. A session without an order
starts with `pickup`, which proposes exactly one card.

## Setting up a checkout

1. `bash scripts/install-git-hooks.sh` installs the history guard.
2. Copy `pixecutive.local.example.json` to `pixecutive.local.json` and fill in your values.
