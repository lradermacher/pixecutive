#!/usr/bin/env bash
# probe-ticket.sh — the work-package state machine and both transition hooks red once and green once per case, in a
# throwaway repo: entry, exit, one verdict on every path, and whose state the verdict reads.
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "probe-ticket.sh: not a git repository." >&2; exit 1; }

# shellcheck source=scripts/lib/probe.sh
source "$root/scripts/lib/probe.sh"
probe_tree_init ticket

card="PIX-998"
mkdir -p "$work/scripts/lib" "$work/.claude/data" "$work/.claude/hooks" "$work/docs/plans/impl"
cp "$root/scripts/ticket.ts" "$work/scripts/"
cp -R "$root/scripts/lib/ticket" "$root/scripts/lib/rules" "$root/scripts/lib/hooks" "$work/scripts/lib/"
cp "$root/scripts/lib/frontmatter.ts" "$root/scripts/lib/data-rows.ts" "$work/scripts/lib/"
cp "$root/.claude/data/ticket-types.tsv" "$root/.claude/data/protected-paths.txt" "$work/.claude/data/"
cp "$root/.claude/hooks/guard-inprogress.ts" "$root/.claude/hooks/guard-done.ts" "$work/.claude/hooks/"
cp -R "$root/.claude/rules" "$work/.claude/rules"
: >"$work/docs/plans/impl/.keep"
# A foreign plan, fully ticked: a key with a glob must never measure it, so a hit would turn a red case green.
printf -- '- [x] foreign\n' >"$work/docs/plans/impl/PLAN_PIX-999_foreign.md"
probe_tree_commit
git -C "$work" checkout -q -b "feat/pix-998-probe"
printf '%s\n' '{"tracker":{"transitions":{"inProgress":"31","done":"51"}}}' >"$work/.probe-config.json"
PROBE_CLEAN_EXCLUDES=(.probe-config.json)
probe_env() {
	export CLAUDE_CODE_SESSION_ID=probe PIXECUTIVE_LOCAL_CONFIG="$work/.probe-config.json"
}

ticket='node scripts/ticket.ts'
plan="docs/plans/impl/PLAN_${card}_probe.md"
plan2="docs/plans/impl/PLAN_${card}_second.md"
feature="$ticket open $card --type feature --title Probe --acceptance 1 >/dev/null 2>&1"
bug="$ticket open $card --type bug --title Probe >/dev/null 2>&1"
transition='{"tool_name":"mcp__atlassian__transitionJiraIssue","tool_input":{"issueIdOrKey":"'"$card"'","transition":{"id":"%s"}}}'
with_key='{"tool_name":"mcp__atlassian__transitionJiraIssue","tool_input":{"issueIdOrKey":"%s","transition":{"id":"%s"}}}'
no_id='{"tool_name":"mcp__atlassian__transitionJiraIssue","tool_input":{"issueIdOrKey":"'"$card"'"}}'
null_id='{"tool_name":"mcp__atlassian__transitionJiraIssue","tool_input":{"issueIdOrKey":"'"$card"'","transition":{"id":null}}}'
null_key='{"tool_name":"mcp__atlassian__transitionJiraIssue","tool_input":{"issueIdOrKey":null,"transition":{"id":"%s"}}}'
other_session='{"session_id":"foreign","tool_name":"mcp__atlassian__transitionJiraIssue","tool_input":{"issueIdOrKey":"'"$card"'","transition":{"id":"%s"}}}'
own_session='{"session_id":"probe","tool_name":"mcp__atlassian__transitionJiraIssue","tool_input":{"issueIdOrKey":"'"$card"'","transition":{"id":"%s"}}}'
other_tool='{"tool_name":"Read","tool_input":{"file_path":"/tmp/x"}}'
entry='node .claude/hooks/guard-inprogress.ts'
leave='node .claude/hooks/guard-done.ts'

# One card, four paths, one answer: boxes, close and the Done hook judge the exit, the In Progress hook the entry.
verdict() {
	local label="$1" setup="$2" want_exit="$3" want_entry="$4" i got want deviation=0 lines=""
	local names=("boxes" "close" "hook done" "hook in progress")
	local commands=("$ticket boxes $card" "$ticket close" "printf '$transition' 51 | $leave" "printf '$transition' 31 | $entry")
	for i in 0 1 2 3; do
		probe_restore
		got="$(cd "$work" && probe_env && export CLAUDE_PROJECT_DIR="$work" && { eval "$setup" >/dev/null 2>&1 || true; eval "${commands[$i]}" >/dev/null 2>&1; } && echo green || echo red)"
		want="$want_exit"
		[ "$i" -eq 3 ] && want="$want_entry"
		if [ "$got" != "$want" ]; then
			deviation=$((deviation + 1))
			lines="$lines
      ${names[$i]}: $got instead of $want"
		fi
	done
	probe_restore
	local result="four paths, one verdict"
	[ "$deviation" -eq 0 ] || result="$deviation of 4 paths answer differently"
	probe_record "$label" "four paths, one verdict" "$result" "$lines"
}

echo "── Entry: no card moves to In Progress without a plan ──────────────────"
probe "no plan, no package: plan-required" red "$ticket plan-required $card"
probe "with a plan: plan-required" green "echo '- [ ] x' > $plan && $ticket plan-required $card"
probe "type bug without a plan: plan-required" green "$bug; $ticket plan-required $card"
probe "type feature, plan removed afterwards" red "echo '- [ ] x' > $plan && $feature; rm -f $plan && $ticket plan-required $card"
probe "hook: in progress without a plan" red "printf '$transition' 31 | $entry"
probe "hook: in progress with a plan" green "echo '- [ ] x' > $plan && printf '$transition' 31 | $entry"
probe "hook: in progress, type bug without a plan" green "$bug; printf '$transition' 31 | $entry"
probe "hook: another transition passes" green "printf '$transition' 41 | $entry"
probe "plan-required with a numeric issue ID" red "echo '- [ ] x' > $plan && $ticket plan-required 10457"
probe "hook: numeric issue ID" red "echo '- [ ] x' > $plan && printf '$with_key' 10457 31 | $entry"
probe "hook: broken JSON" red "printf '{\"tool_name\":\"mcp__atlassian__transitionJiraIssue\", {' | $entry"
probe "hook: no transition.id" red "printf '$no_id' | $entry"
probe "hook: transition.id is null" red "echo '- [ ] x' > $plan && printf '$null_id' | $entry"
probe "hook: issueIdOrKey is null" red "echo '- [ ] x' > $plan && printf '$null_key' 31 | $entry"
probe "hook: without the local config the target is unknown" red \
	"echo '- [ ] x' > $plan && printf '$transition' 31 | PIXECUTIVE_LOCAL_CONFIG=/nonexistent $entry"
probe "hook: a broken library makes it reject" red \
	"echo 'export function (' > scripts/lib/ticket/guard-transition.ts; echo '- [ ] x' > $plan && printf '$transition' 31 | $entry"
probe "hook: another tool passes" green "printf '$other_tool' | $entry"
probe "hook: whitespace in the key" red "echo '- [ ] x' > $plan && printf '$with_key' '$card x' 31 | $entry"
probe "plan-required with a glob in the key" red "$ticket plan-required 'PIX-9*'"
probe "hook: glob in the key" red "printf '$with_key' 'PIX-9*' 31 | $entry"

echo
echo "── Open: type and title come from the arguments ────────────────────────"
probe "open without --type" red "$ticket open $card --title Probe"
probe "open without --title" red "$ticket open $card --type bug"
probe "open with an unknown --type" red "$ticket open $card --type invented --title Probe"
probe "open writes type and title into the state" green "$bug; $ticket show | grep -q 'PIX-998 (bug) — Probe'"
probe "open a second card while the first is open" red \
	"$bug; git branch -m feat/pix-997-series; $ticket open PIX-997 --type bug --title Second; rc=\$?; git branch -m feat/pix-998-probe; exit \$rc"
probe "after close the same session opens the next card" green \
	"$bug; $ticket close >/dev/null; git branch -m feat/pix-997-series; $ticket open PIX-997 --type bug --title Second >/dev/null && $ticket show | grep -q PIX-997; rc=\$?; git branch -m feat/pix-998-probe; exit \$rc"
probe "open on a branch of another card" red "$ticket open PIX-997 --type bug --title Probe"
probe "two reviews per card pass" green "$bug; $ticket review-done >/dev/null && $ticket review-done >/dev/null"
probe "the third review is rejected" red "$bug; $ticket review-done >/dev/null; $ticket review-done >/dev/null; $ticket review-done"
probe "PIX_REVIEW_AGAIN=1 lets the third pass" green \
	"$bug; $ticket review-done >/dev/null; $ticket review-done >/dev/null; PIX_REVIEW_AGAIN=1 $ticket review-done >/dev/null"
probe "show names the record and the next diff" green \
	"$bug; $ticket review-done --findings 3 >/dev/null; $ticket show | grep -q '3 finding' && $ticket show | grep -qE 'git diff [0-9a-f]{12}\\.\\.HEAD'"
probe "show skips the record of another card" green \
	"CLAUDE_CODE_SESSION_ID=foreign $ticket review-done >/dev/null; $bug; ! $ticket show | grep -q 'git diff'"
probe "sweep removes a record whose commit is on no branch" green \
	"$bug; $ticket review-done --sha 0123456789abcdef0123456789abcdef01234567 >/dev/null; $ticket sweep; [ ! -f .claude/state/review.probe.json ]"
probe "sweep keeps a record whose commit is on the branch" green "$bug; $ticket review-done >/dev/null; $ticket sweep; [ -f .claude/state/review.probe.json ]"
probe "sweep removes a stale file of a kind nothing writes" green \
	"mkdir -p .claude/state && echo '{}' > .claude/state/gone.probe.json && touch -t 202001010000 .claude/state/gone.probe.json && $ticket sweep; [ ! -f .claude/state/gone.probe.json ]"
probe "sweep keeps a fresh file of a kind nothing writes" green \
	"mkdir -p .claude/state && echo '{}' > .claude/state/gone.probe.json && $ticket sweep; [ -f .claude/state/gone.probe.json ]"
probe "sweep keeps the review tally" green \
	"$bug; $ticket review-done >/dev/null; touch -t 202001010000 .claude/state/reviews.*.count; $ticket sweep; ls .claude/state/reviews.*.count >/dev/null"
probe "no Jira access and no secret in the code" green \
	"! grep -hvE '^[[:space:]]*(//|\\*)' scripts/ticket.ts scripts/lib/ticket/*.ts .claude/hooks/guard-*.ts | grep -niE 'atlassian\\.net|api[_-]?token|authorization|bearer |fetch\\('"

echo
echo "── Exit: no card moves to Done with an open box ────────────────────────"
probe "hook: done with an open box" red "echo '- [ ] x' > $plan && $feature; printf '$transition' 51 | $leave"
probe "hook: done with every box ticked" green "echo '- [x] x' > $plan && $feature; printf '$transition' 51 | $leave"
probe "the message names the open box" green \
	"echo '- [ ] x' > $plan && $feature; printf '$transition' 51 | $leave 2> verdict.txt; grep -q 'open boxes' verdict.txt"
probe "hook: another transition passes" green "echo '- [ ] x' > $plan && printf '$transition' 41 | $leave"
probe "boxes with a numeric issue ID" red "echo '- [x] x' > $plan && $ticket boxes 10457"
probe "hook: numeric issue ID" red "echo '- [x] x' > $plan && printf '$with_key' 10457 51 | $leave"
probe "hook: broken JSON" red "printf '{\"tool_name\":\"mcp__atlassian__transitionJiraIssue\", {' | $leave"
probe "hook: transition.id is null" red "echo '- [x] x' > $plan && printf '$null_id' | $leave"
probe "hook: another tool passes" green "printf '$other_tool' | $leave"
probe "boxes: plan removed afterwards" red "echo '- [x] x' > $plan && $feature; rm -f $plan && $ticket boxes $card"
probe "boxes: no plan, no package" red "$ticket boxes $card"
probe "boxes: type bug without a plan is plan-free" green "$bug; $ticket boxes $card"
probe "close: plan removed afterwards" red "echo '- [x] x' > $plan && $feature; rm -f $plan && $ticket close"
probe "close: type bug without a plan" green "$bug; $ticket close"
probe "boxes with a glob reaches no foreign plan" red "$ticket boxes 'PIX-9*'"
probe "boxes: a rule still names the card as owner of a planned mechanism" red \
	"echo '- [x] x' > $plan && $feature; printf '\n## Probe rule\nText. \`[Planned $card: Lint probe]\`\n' >> .claude/rules/core.md; $ticket boxes $card"
probe "boxes: a promise behind another mechanism in the bracket counts too" red \
	"echo '- [x] x' > $plan && $feature; printf '\n## Probe rule\nText. \`[Lint x · Planned $card: Lint probe]\`\n' >> .claude/rules/core.md; $ticket boxes $card"
probe "boxes: a promise in an ADR counts too" red \
	"echo '- [x] x' > $plan && $feature; mkdir -p docs/ADR; printf 'Point. \`[Planned $card: Hook probe]\`\n' > docs/ADR/0001-probe.md; $ticket boxes $card"
probe "boxes: a promise for another card does not count" green \
	"echo '- [x] x' > $plan && $feature; printf '\n## Probe rule\nText. \`[Planned PIX-997: Lint probe]\`\n' >> .claude/rules/core.md; $ticket boxes $card"

echo
echo "── Verdict: a box is a box, and none is not all ticked ─────────────────"
probe "'+ [ ]' is an open box" red "printf '+ [ ] x\n' > $plan; $feature; $ticket boxes $card"
probe "'+ [x]' stays ticked" green "printf '+ [x] x\n' > $plan; $feature; $ticket boxes $card"
probe "a plan without any box" red "echo 'only prose' > $plan; $bug; $ticket boxes $card"
probe "two plans, the open box in the second" red "echo '- [x] a' > $plan && echo '- [ ] b' > $plan2 && $ticket boxes $card"
probe "two fully ticked plans stay ambiguous" red "echo '- [x] a' > $plan && echo '- [x] b' > $plan2 && $ticket boxes $card"
probe "the message names both plans" green \
	"echo '- [x] a' > $plan && echo '- [x] b' > $plan2; $ticket boxes $card > verdict.txt; grep -q _probe verdict.txt && grep -q _second verdict.txt"
forge="perl -pi -e 's/\"title\": \"Probe\"/\"title\": \"Forged\"/' .claude/state/ticket.probe.json"
probe "close with a forged state" red "echo '- [ ] open' > $plan && $feature; $forge && $ticket close"
probe "close --force does not pass a broken signature" red "echo '- [ ] open' > $plan && $feature; $forge && $ticket close --force"
probe "close without a package claims no closing" green "! $ticket close | grep -q 'Work package closed'"
verdict "card with 5 lines, plan with 1 ticked" "echo '- [x] one' > $plan; $ticket open $card --type feature --title Probe --acceptance 5" red green
verdict "card with 5 lines, plan with 5 ticked" \
	"printf -- '- [x] a\n- [x] b\n- [x] c\n- [x] d\n- [x] e\n' > $plan; $ticket open $card --type feature --title Probe --acceptance 5" green green
verdict "card with 5 lines, one of them open" \
	"printf -- '- [x] a\n- [x] b\n- [ ] c\n- [x] d\n- [x] e\n' > $plan; $ticket open $card --type feature --title Probe --acceptance 5" red green
verdict "plan removed after opening" "echo '- [x] a' > $plan; $ticket open $card --type feature --title Probe --acceptance 5; rm -f $plan" red red
verdict "two plans for one card" "echo '- [x] a' > $plan; $ticket open $card --type feature --title Probe --acceptance 1; echo '- [x] b' > $plan2" red red
verdict "a plan without any box" "echo 'only prose' > $plan; $ticket open $card --type bug --title Probe" red green
verdict "type bug without a plan is plan-free everywhere" "$ticket open $card --type bug --title Probe" green green

echo
echo "── Session: the verdict reads this session's state only ────────────────"
probe "a foreign bug state does not make the card plan-free" red \
	"echo '- [x] x' > $plan && CLAUDE_CODE_SESSION_ID=aaa $ticket open $card --type bug --title Foreign >/dev/null 2>&1; rm -f $plan && $ticket boxes $card"
probe "the acceptance count of a foreign session does not count" green \
	"echo '- [x] x' > $plan && $feature; CLAUDE_CODE_SESSION_ID=zzz $ticket open $card --type feature --title Foreign --acceptance 5 >/dev/null 2>&1; $ticket boxes $card"
probe "the own count holds when a foreign one is smaller" red \
	"echo '- [x] x' > $plan && $ticket open $card --type feature --title Probe --acceptance 5 >/dev/null 2>&1; CLAUDE_CODE_SESSION_ID=aaa $ticket open $card --type feature --title Foreign --acceptance 1 >/dev/null 2>&1; $ticket boxes $card"
probe "no state of this session, a ticked plan" red "echo '- [x] x' > $plan && $ticket boxes $card"
probe "boxes after close --force" red \
	"printf -- '- [x] one\n' > $plan && $ticket open $card --type feature --title Probe --acceptance 5 >/dev/null 2>&1; $ticket close --force >/dev/null 2>&1; $ticket boxes $card"
probe "hook done after close --force" red \
	"printf -- '- [x] one\n' > $plan && $ticket open $card --type feature --title Probe --acceptance 5 >/dev/null 2>&1; $ticket close --force >/dev/null 2>&1; printf '$transition' 51 | $leave"
probe "close --force says the card is not accepted" green \
	"printf -- '- [ ] open\n' > $plan && $feature; $ticket close --force | grep -q 'not accepted'"
probe "close --force closes the session despite an open box" green \
	"printf -- '- [ ] open\n' > $plan && $feature; $ticket close --force >/dev/null 2>&1; $ticket show | grep -q 'no work package'"
closed="printf -- '- [x] one\n- [x] two\n' > $plan && $ticket open $card --type feature --title Probe --acceptance 2 >/dev/null 2>&1 && $ticket close >/dev/null 2>&1"
probe "boxes from a later session after a confirmed close" green "$closed && CLAUDE_CODE_SESSION_ID=later $ticket boxes $card"
probe "hook done from a later session after a confirmed close" green "$closed && printf '$transition' 51 | CLAUDE_CODE_SESSION_ID=later $leave"
probe "closing record, but a box opened again" red \
	"$closed && printf -- '- [x] one\n- [ ] two\n' > $plan && CLAUDE_CODE_SESSION_ID=later $ticket boxes $card"
probe "closing record, but the plan no longer covers the card" red \
	"$closed && printf -- '- [x] one\n' > $plan && CLAUDE_CODE_SESSION_ID=later $ticket boxes $card"
probe "a closing record edited by hand does not count" red \
	"$closed && printf -- '- [x] one\n' > $plan && perl -pi -e 's/\"acceptanceLines\": 2/\"acceptanceLines\": 1/' .claude/state/card.$card.json && CLAUDE_CODE_SESSION_ID=later $ticket boxes $card"
probe "close --force deletes an earlier closing record" red \
	"$closed && $ticket open $card --type feature --title Probe --acceptance 3 >/dev/null 2>&1 && $ticket close --force >/dev/null 2>&1 && CLAUDE_CODE_SESSION_ID=later $ticket boxes $card"
probe "at the entry no closing record counts" red \
	"rm -f $plan && $bug && $ticket close >/dev/null 2>&1 && CLAUDE_CODE_SESSION_ID=later $ticket plan-required $card"
probe "open without --acceptance for a type that needs a plan" red "echo '- [ ] x' > $plan && $ticket open $card --type feature --title Probe"
probe "open with --acceptance 0" red "echo '- [ ] x' > $plan && $ticket open $card --type feature --title Probe --acceptance 0"
probe "open with a non-numeric --acceptance" red "echo '- [ ] x' > $plan && $ticket open $card --type feature --title Probe --acceptance five"
probe "open without --acceptance stays allowed for type bug" green "$ticket open $card --type bug --title Probe"
probe "opening again does not lower the count" red \
	"printf -- '- [x] one\n' > $plan && $ticket open $card --type feature --title Probe --acceptance 5 >/dev/null 2>&1; $feature; $ticket boxes $card"
probe "hook done: a foreign session in the input is red" red \
	"echo '- [x] x' > $plan && $feature; printf '$other_session' 51 | $leave"
probe "hook done: the own session in the input passes" green "echo '- [x] x' > $plan && $feature; printf '$own_session' 51 | $leave"
probe "hook in progress: a foreign session does not know type bug" red "$bug; printf '$other_session' 31 | $entry"

echo
probe_done
