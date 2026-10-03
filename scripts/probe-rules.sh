#!/usr/bin/env bash
# probe-rules.sh — every gate of check-rules, rules-for and the rule-context hook red once and green once, on copies
# of the real rules in a throwaway repo, so an aborted run leaves no tampered rule behind.
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "probe-rules.sh: not a git repository." >&2; exit 1; }

# shellcheck source=scripts/lib/probe.sh
source "$root/scripts/lib/probe.sh"
probe_tree_init rules

mkdir -p "$work/.claude/hooks" "$work/scripts/lib" "$work/docs"
cp -R "$root/.claude/rules" "$work/.claude/rules"
cp "$root/.claude/hooks/rule-context.ts" "$work/.claude/hooks/"
cp "$root/scripts/check-rules.ts" "$root/scripts/rules-for.ts" "$work/scripts/"
cp -R "$root/scripts/lib/rules" "$root/scripts/lib/frontmatter.ts" "$work/scripts/lib/"
cp -R "$root/docs/ADR" "$work/docs/ADR"
cp "$root/CLAUDE.md" "$work/CLAUDE.md"
probe_tree_commit

check='node scripts/check-rules.ts'
filler='A filler line long enough for the budget to notice it, because tokens count characters and not line breaks.'
bloat() { for i in $(seq "$2"); do echo "$i $filler" >>"$1"; done; }
rule() { printf '%s\n' '---' "$@" '---' '' '# Probe' '' '## A probe rule that names its mechanism' 'Text. `[Prose: probe]`' >.claude/rules/probe.md; }
adr='adr: docs/ADR/0001-one-carrier-per-rule.md'

echo "── Starting state ──────────────────────────────────────────────────────"
probe "every gate on the real rules" green "$check"
probe "the load probes of rules-for" green "node scripts/rules-for.ts --probe"
probe "one 30,000-character line breaks the token limit" red \
	"node -e 'process.stdout.write(\"x\".repeat(30000))' >> .claude/rules/core.md; node scripts/rules-for.ts --probe"

echo
echo "── Duplicate ───────────────────────────────────────────────────────────"
probe "a heading of basis copied into core" red "grep -m1 '^## ' .claude/rules/basis.md >> .claude/rules/core.md; $check duplicate"
probe "a heading of basis copied into CLAUDE.md" red "grep -m1 '^## ' .claude/rules/basis.md >> CLAUDE.md; $check duplicate"
probe "a long body line of ops copied into core" red \
	"sed -n '/^# /,\$p' .claude/rules/ops.md | grep -m1 '^[A-Z].\{60,\}' >> .claude/rules/core.md; $check duplicate"
probe "the same rule reworded in a second carrier" red \
	"echo '## Everything in this repo is English, including drafts' >> CLAUDE.md; $check duplicate"
probe "a mere reference to the rule is no duplicate" green \
	"echo 'The language rule lives in .claude/rules/basis.md; read it there.' >> CLAUDE.md; $check duplicate"

echo
echo "── Budget ──────────────────────────────────────────────────────────────"
probe "core bloated beyond the limit" red "bloat .claude/rules/core.md 200; $check budget"
probe "the baseline alone beyond the limit" red "bloat .claude/rules/basis.md 200; $check budget"
probe "CLAUDE.md beyond the limit" red "bloat CLAUDE.md 200; $check budget"
# A path that matches two areas loads both; neither alone is too large here, together they are.
probe "two overlapping areas break the limit together" red \
	"perl -pi -e 's|  - \"scripts/\\*\"|  - \"packages/*\"|' .claude/rules/ops.md &&
	 bloat .claude/rules/ops.md 90 && bloat .claude/rules/core.md 90 && $check budget"
agreement='a=$($check budget | grep -oE "[0-9]+/[0-9]+ tokens|[0-9]+ tokens loaded" | grep -oE "^[0-9]+")
	b=$(node scripts/rules-for.ts --budget | grep -E "Worst case" | grep -oE "[0-9]+" | head -1)
	echo "check-rules=$a rules-for=$b"; [ -n "$a" ] && [ "$a" = "$b" ]'
probe "check-rules and rules-for name the same number" green "$agreement"
probe "the same number above the limit as well" green "bloat .claude/rules/core.md 200; $agreement"

echo
echo "── Loading ─────────────────────────────────────────────────────────────"
probe "core loads for packages/core" green "node scripts/rules-for.ts packages/core/src/x.ts | grep -q 'rules/core.md'"
probe "a falsified pattern no longer loads core" red \
	"perl -pi -e 's|  - \"packages/\\*\"|  - \"elsewhere/*\"|' .claude/rules/core.md &&
	 node scripts/rules-for.ts packages/core/src/x.ts | grep -q 'rules/core.md'"

echo
echo "── Structure, mechanism, globs ─────────────────────────────────────────"
probe "a well-formed new rule" green "rule 'paths:' '  - \"probe/*\"' \"$adr\" 'summary: short' && $check structure && $check mechanism"
probe "paths ** would silently always load" red "rule 'paths:' '  - \"**\"' \"$adr\" 'summary: short'; $check structure"
probe "adr pointing nowhere" red "rule 'paths:' '  - \"probe/*\"' 'adr: docs/ADR/9999-none.md' 'summary: short'; $check structure"
probe "summary missing" red "rule 'paths:' '  - \"probe/*\"' \"$adr\"; $check structure"
probe "summary above 60 words" red "rule 'paths:' '  - \"probe/*\"' \"$adr\" \"summary: \$(printf 'word %.0s' \$(seq 61))\"; $check structure"
probe "a pattern not anchored at the root" red "rule 'paths:' '  - \"probe/**\"' \"$adr\" 'summary: short'; $check structure"
probe "a root file with a leading slash" green "rule 'paths:' '  - \"/probe.json\"' \"$adr\" 'summary: short'; $check structure"
probe "a negated pattern" red "rule 'paths:' '  - \"!probe/*\"' \"$adr\" 'summary: short'; $check structure"
probe "a rule without a mechanism" red "printf '%s\n' '' '## A rule without its bracket' 'Text.' >> .claude/rules/core.md; $check mechanism"
probe "a path set copied into the rule tooling" red "echo '// apps/server/**' >> scripts/rules-for.ts; $check globs"
probe "an unknown gate name stops with exit 2" green "$check dupes; [ \$? -eq 2 ]"

echo
echo "── The rule-context hook ───────────────────────────────────────────────"
hook() { printf '{"tool_name":"Write","session_id":"probe-%s","tool_input":{"file_path":"packages/core/src/x.ts"}}' "$RANDOM$RANDOM" |
	node .claude/hooks/rule-context.ts; }
probe "intact: injects core, exit 0" green "hook | grep -q '\\[core\\]'"
probe "a second write in the same area injects nothing" green \
	"s=probe-\$RANDOM\$RANDOM; i=\"{\\\"tool_name\\\":\\\"Write\\\",\\\"session_id\\\":\\\"\$s\\\",\\\"tool_input\\\":{\\\"file_path\\\":\\\"packages/core/a.ts\\\"}}\";
	 echo \"\$i\" | node .claude/hooks/rule-context.ts >/dev/null && [ -z \"\$(echo \"\$i\" | node .claude/hooks/rule-context.ts)\" ]"
probe "a broken rule loader makes the hook loud" red "echo 'export function (' > scripts/lib/rules/load-rules.ts; hook"
probe "a broken rule loader never blocks with exit 2" green \
	"echo 'export function (' > scripts/lib/rules/load-rules.ts; hook; [ \$? -ne 2 ]"
probe "garbage on stdin stays a silent exit 0" green "printf 'no json' | node .claude/hooks/rule-context.ts"

echo
probe_done
