#!/usr/bin/env bash
# probe-carriers.sh — every check of check-carriers red once and green once: named carriers, hook contracts, agent
# fields and data heads, in a throwaway repo with one of each.
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "probe-carriers.sh: not a git repository." >&2; exit 1; }

# shellcheck source=scripts/lib/probe.sh
source "$root/scripts/lib/probe.sh"
probe_tree_init carriers

mkdir -p "$work/scripts/lib" "$work/docs/ADR" "$work/.claude/rules" "$work/.claude/hooks" "$work/.claude/skills/code" \
	"$work/.claude/agents" "$work/.claude/data"
cp "$root/scripts/check-carriers.ts" "$work/scripts/"
cp "$root/scripts/lib/frontmatter.ts" "$work/scripts/lib/"
cp "$root/.claude/hooks/agent-done.ts" "$work/.claude/hooks/"
printf '%s\n' '# probe' >"$work/scripts/probe-hooks.sh"
printf '%s\n' '# code' >"$work/.claude/skills/code/SKILL.md"
printf '%s\n' '// ticket' >"$work/scripts/ticket.ts"
printf '%s\n' '---' 'name: research' 'description: Probe.' 'tools: Read' 'model: opus' '---' >"$work/.claude/agents/research.md"
printf '%s\n' '---' 'schema: probe' 'read-by:' '  - x' 'adr: none' 'generated: no' '---' 'a' >"$work/.claude/data/words.tsv"
printf '%s\n' '# Rules' >"$work/.claude/rules/README.md"
printf "%s\n" "# ADR" >"$work/docs/ADR/README.md"
probe_tree_commit
check='node scripts/check-carriers.ts'
adr() { printf '%s\n' '---' "status: ${2:-accepted}" '---' '' '# ADR 0001' '' "A point. \`[$1]\`" >docs/ADR/0001-probe.md; }

echo "── named ───────────────────────────────────────────────────────────────"
probe "an existing skill" green "adr 'Skill code' && $check named"
probe "a missing skill" red "adr 'Skill missing' && $check named"
probe "an existing hook beside a gate of free text" green "adr 'Hook agent-done · Gate history guard denylist' && $check named"
probe "a script with a subcommand" green "adr 'Gate ticket.ts open' && $check named"
probe "a missing script with a subcommand" red "adr 'Gate card.ts open' && $check named"
probe "a missing hook with a dash before free text" red "adr 'Hook guard-gone on every write' && $check named"
probe "an existing agent" green "adr 'Agent research' && $check named"
probe "a missing agent" red "adr 'Agent reviewer' && $check named"
probe "a harness agent needs no file" green "adr 'Agent Explore' && $check named"
probe "a planned mechanism is no claim" green "adr 'Planned PIX-7: Hook architecture-guard' && $check named"
probe "a superseded ADR may name what is gone" green "adr 'Skill missing' superseded && $check named"
probe "the same line in a rule is measured" red "printf '%s\n' '# Probe' 'A rule. \`[Hook missing]\`' > .claude/rules/probe.md && $check named"
probe "a bracket across a line break" red \
	"printf '%s\n' '---' 'status: accepted' '---' '' 'Point. \`[Gate ticket.ts open ·' 'Hook missing]\`' > docs/ADR/0001-probe.md && $check named"

echo
echo "── hooks ───────────────────────────────────────────────────────────────"
probe "a hook with its contract" green "$check hooks"
probe "a hook without a contract" red "printf '%s\n' '// x.ts — probe' > .claude/hooks/x.ts && $check hooks"
probe "a contract without its probe field" red "perl -ni -e 'print unless /^\\tprobe: /' .claude/hooks/agent-done.ts && $check hooks"
probe "a contract naming a probe that does not exist" red "rm scripts/probe-hooks.sh && $check hooks"

echo
echo "── agents and data ─────────────────────────────────────────────────────"
probe "an agent without model:" red "perl -ni -e 'print unless /^model: /' .claude/agents/research.md && $check agents"
probe "a data file without adr:" red "perl -ni -e 'print unless /^adr: /' .claude/data/words.tsv && $check data"
probe "a data file with a comment head" green \
	"printf '%s\n' '# schema: x' '# read-by: y' '# adr: none' '# generated: no' 'a' > .claude/data/list.txt && $check data"
probe "an unknown check stops with exit 2" green "$check nonsense; [ \$? -eq 2 ]"

echo
probe_done
