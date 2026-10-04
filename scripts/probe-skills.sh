#!/usr/bin/env bash
# probe-skills.sh — every check of check-skills red once and green once, against a sample skill in a throwaway repo,
# so each case breaks exactly one property; a first case runs the gate on the real repo.
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "probe-skills.sh: not a git repository." >&2; exit 1; }

# shellcheck source=scripts/lib/probe.sh
source "$root/scripts/lib/probe.sh"
probe_tree_init skills

mkdir -p "$work/scripts/lib" "$work/.claude/data" "$work/.claude/rules" "$work/.claude/skills/sample"
cp "$root/scripts/check-skills.ts" "$work/scripts/"
cp "$root/scripts/lib/frontmatter.ts" "$root/scripts/lib/data-rows.ts" "$work/scripts/lib/"
echo "# Probe rule" >"$work/.claude/rules/probe.md"
cat >"$work/.claude/skills/sample/SKILL.md" <<'SKILL'
---
name: sample
description: A sample skill for the probe. Use it when a gate has to show that it can fail.
rules:
  - .claude/rules/probe.md
data: []
gates: []
---

# sample — the shape the gate measures

At the end a probe stands that is green while nobody breaks it.

## Steps

1. **Do nothing** — the skill exists so the gate has something to measure.

## Acceptance

- [ ] The gate is green
SKILL
printf '%s\n' '---' 'schema: probe' 'read-by:' '  - scripts/check-skills.ts' 'adr: none' 'generated: no' '---' '' 'skill' 'sample' \
	>"$work/.claude/data/skill-conformance.tsv"
probe_tree_commit
check='node scripts/check-skills.ts'
skill='.claude/skills/sample/SKILL.md'

echo "── The real repo and the sample ────────────────────────────────────────"
probe_case "check-skills on the real repo" green "(cd '$root' && node scripts/check-skills.ts)"
probe "every check on the sample" green "$check"
probe "an unknown check stops with exit 2" green "$check nonsense; [ \$? -eq 2 ]"

echo
echo "── structure ───────────────────────────────────────────────────────────"
probe "the field gates: removed" red "perl -ni -e 'print unless /^gates: /' $skill; $check structure"
probe "the Acceptance section removed" red "perl -0pi -e 's/## Acceptance.*//s' $skill; $check structure"
probe "Steps without a numbered step" red "perl -ni -e 'print unless /^1\\. \\*\\*/' $skill; $check structure"
probe "a when: field" red "perl -pi -e 's/^name: sample\$/name: sample\nwhen: sometimes/' $skill; $check structure"
probe "a side file no data: entry names" red "echo x > .claude/skills/sample/notes.md; $check structure"
probe "the same side file named in data:" green \
	"echo x > .claude/skills/sample/notes.md; perl -pi -e 's/^data: \\[\\]\$/data:\n  - .claude\\/skills\\/sample\\/notes.md/' $skill; $check structure"

echo
echo "── reference ───────────────────────────────────────────────────────────"
probe "a rules: path that leads nowhere" red "perl -pi -e 's/probe\\.md/missing.md/' $skill; $check reference"
probe "a repo path as a code span" red "printf '\nSee \`docs/spec/MAP.md\` there.\n' >> $skill; $check reference"
probe "a placeholder in a code span is no path" green "printf '\nThe card lies under \`packages/<name>/\`.\n' >> $skill; $check reference"
probe "a link to a renamed skill" red "printf '\nSee [old](../gone/SKILL.md).\n' >> $skill; $check reference"
probe "a link to an existing file" green "printf '\nSee [the rule](../../rules/probe.md).\n' >> $skill; $check reference"
probe "a web address is no file path" green "printf '\nSee [the docs](https://example.org/x).\n' >> $skill; $check reference"
probe "a command with a path is no reference" green "printf '\nRun: \`node scripts/check-skills.ts\`.\n' >> $skill; $check reference"

echo
echo "── boundary ────────────────────────────────────────────────────────────"
probe "a rule line without a link" red "printf '\n⛔ Never build without saying so.\n' >> $skill; $check boundary"
probe "the same line with a link" green "printf '\n⛔ Never build without saying so, see [basis](../../rules/probe.md).\n' >> $skill; $check boundary"
probe "a date in the text" red "printf '\nThis came up on 2026-09-18.\n' >> $skill; $check boundary"

echo
echo "── budget ──────────────────────────────────────────────────────────────"
probe "a description above 300 characters" red "perl -pi -e 's/^description: /description: '\$(printf 'x%.0s' \$(seq 310))' /' $skill; $check budget"

echo
echo "── roster ──────────────────────────────────────────────────────────────"
probe "a new skill without a row" red "mkdir -p .claude/skills/new && printf -- '---\nname: new\n---\n' > .claude/skills/new/SKILL.md; $check roster"
probe "a row naming no skill" red "echo missing >> .claude/data/skill-conformance.tsv; $check roster"
probe "the same skill twice" red "echo sample >> .claude/data/skill-conformance.tsv; $check roster"
probe "the roster missing" red "rm .claude/data/skill-conformance.tsv; $check roster"

echo
probe_done
