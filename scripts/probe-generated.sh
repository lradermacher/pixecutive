#!/usr/bin/env bash
# probe-generated.sh — check-generated, generate-skills-index --check and generate-adr-state --check red once and
# green once per case, in a throwaway repo with one skill, one ADR and one plan.
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "probe-generated.sh: not a git repository." >&2; exit 1; }

# shellcheck source=scripts/lib/probe.sh
source "$root/scripts/lib/probe.sh"
probe_tree_init generated

mkdir -p "$work/scripts/lib" "$work/.claude/data" "$work/.claude/skills/sample" "$work/docs/ADR" "$work/docs/plans/impl"
cp "$root/scripts/check-generated.ts" "$root/scripts/generate-skills-index.ts" "$root/scripts/generate-adr-state.ts" "$work/scripts/"
cp "$root/scripts/lib/frontmatter.ts" "$root/scripts/lib/data-rows.ts" "$work/scripts/lib/"
cp "$root/.claude/data/generated-files.tsv" "$work/.claude/data/"
printf '%s\n' '---' 'name: sample' 'description: A sample skill for the probe.' '---' >"$work/.claude/skills/sample/SKILL.md"
printf '%s\n' '---' 'status: accepted' 'date: 2026-01-01' 'decision-makers: probe' 'kind: workflow' 'supersedes: []' \
	'superseded-by: null' 'analysis: —' 'implementation: —' '---' '' '# ADR 0001 — Probe' '' '<!-- STATE:BEGIN -->' \
	'<!-- STATE:END -->' >"$work/docs/ADR/0001-probe.md"
printf '%s\n' '# Plan' '' 'ADR 0001 point 1.' >"$work/docs/plans/impl/PLAN_PIX-1_probe.md"
(cd "$work" && node scripts/generate-skills-index.ts >/dev/null && node scripts/generate-adr-state.ts >/dev/null)
probe_tree_commit

check='node scripts/check-generated.ts'
echo "── check-generated ─────────────────────────────────────────────────────"
probe "every output names its generator" green "$check"
probe "the head line is missing" red "tail -n +2 .claude/SKILLS.md > x && mv x .claude/SKILLS.md && $check"
probe "the head line stands in line six" red "printf 'a\nb\nc\nd\ne\n' | cat - .claude/SKILLS.md > x && mv x .claude/SKILLS.md && $check"
probe "a block without its generator" red "printf '%s\n' '<!-- STATE:BEGIN -->' '<!-- STATE:END -->' > docs/ADR/0002-other.md && $check"
probe "a generator without a row" red "printf '%s\n' '// x' > scripts/generate-more.ts && $check"
probe "a row whose output is gone" red "rm .claude/SKILLS.md && $check"

echo
echo "── generate-skills-index ───────────────────────────────────────────────"
probe "the register matches" green "node scripts/generate-skills-index.ts --check"
probe "the register edited by hand" red "echo extra >> .claude/SKILLS.md && node scripts/generate-skills-index.ts --check"
probe "a new skill without regeneration" red \
	"mkdir -p .claude/skills/other && printf '%s\n' '---' 'name: other' 'description: Another.' '---' > .claude/skills/other/SKILL.md && node scripts/generate-skills-index.ts --check"
probe "after regeneration" green \
	"mkdir -p .claude/skills/other && printf '%s\n' '---' 'name: other' 'description: Another.' '---' > .claude/skills/other/SKILL.md && node scripts/generate-skills-index.ts >/dev/null && node scripts/generate-skills-index.ts --check"

echo
echo "── generate-adr-state ──────────────────────────────────────────────────"
state='node scripts/generate-adr-state.ts'
probe "the table matches" green "$state --check"
probe "the plan names the ADR, so its card is in the table" green "grep -q 'PIX-1' docs/ADR/0001-probe.md"
probe "the table edited by hand" red "perl -pi -e 's/\\| accepted /| proposed /' docs/ADR/0001-probe.md && $state --check"
probe "the frontmatter changed, the table not" red "perl -pi -e 's/^status: accepted/status: superseded/' docs/ADR/0001-probe.md && $state --check"
probe "a new plan names the ADR" red "printf '%s\n' 'ADR 0001.' > docs/plans/impl/PLAN_PIX-2_other.md && $state --check"
probe "after regeneration" green "printf '%s\n' 'ADR 0001.' > docs/plans/impl/PLAN_PIX-2_other.md && $state >/dev/null && $state --check"
probe "a plan naming ADR 00012 is no reference to 0001" green "printf '%s\n' 'ADR 00012.' > docs/plans/impl/PLAN_PIX-3_x.md && $state --check"
probe "an ADR without a state block" red "printf '%s\n' '---' 'status: accepted' '---' > docs/ADR/0002-bare.md && $state --check"

echo
probe_done
