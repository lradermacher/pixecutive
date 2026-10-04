#!/usr/bin/env bash
# probe-hooks.sh — protect-env, require-ticket, both window hooks, session start and end, the agent hooks and
# check-settings red once and green once per case, with the JSON the harness sends, in a throwaway repo.
# cspell:ignore kartei
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "probe-hooks.sh: not a git repository." >&2; exit 1; }

# shellcheck source=scripts/lib/probe.sh
source "$root/scripts/lib/probe.sh"
probe_tree_init hooks

mkdir -p "$work/scripts/lib" "$work/.claude/data"
cp "$root/scripts/ticket.ts" "$root/scripts/check-settings.ts" "$work/scripts/"
cp -R "$root/scripts/lib/ticket" "$root/scripts/lib/rules" "$root/scripts/lib/hooks" "$root/scripts/lib/agents" "$work/scripts/lib/"
cp "$root/scripts/lib/frontmatter.ts" "$root/scripts/lib/data-rows.ts" "$work/scripts/lib/"
cp -R "$root/scripts/lib/shell" "$root/scripts/lib/comments" "$work/scripts/lib/"
cp "$root/scripts/check-english.ts" "$root/scripts/check-comments.ts" "$root/scripts/check-one-export.ts" "$root/scripts/lib/files-to-check.ts" "$work/scripts/"
mv "$work/scripts/files-to-check.ts" "$work/scripts/lib/"
cp "$root/cspell.json" "$work/" && cp -R "$root/.cspell" "$work/"
ln -s "$root/node_modules" "$work/node_modules"
cp -R "$root/.claude/hooks" "$work/.claude/hooks"
cp "$root/.claude/settings.json" "$work/.claude/"
cp "$root/.claude/data/ticket-types.tsv" "$root/.claude/data/protected-paths.txt" "$root/.claude/data/model-routing.md" "$work/.claude/data/"
printf "node_modules\n" > "$work/.gitignore"
probe_tree_commit
git -C "$work" checkout -q -b "feat/pix-998-probe"
probe_env() { export CLAUDE_CODE_SESSION_ID="probe-$RANDOM$RANDOM"; }

hook() { node ".claude/hooks/$1.ts"; }
tool() { printf '{"tool_name":"%s","session_id":"%s","tool_input":{"%s":"%s"}}' "$1" "$CLAUDE_CODE_SESSION_ID" "$2" "$3"; }
prompt() { printf '{"session_id":"%s","prompt":"%s"}' "$CLAUDE_CODE_SESSION_ID" "$1"; }
agent() { printf '{"tool_name":"Agent","session_id":"%s","tool_input":{"subagent_type":"%s","model":"%s"}}' "$CLAUDE_CODE_SESSION_ID" "$1" "$2"; }
package='node scripts/ticket.ts open PIX-998 --type bug --title Probe >/dev/null'

echo "── protect-env ─────────────────────────────────────────────────────────"
probe "Write on .env" red "tool Write file_path /repo/.env | hook protect-env"
probe "Edit on .env.production" red "tool Edit file_path /repo/.env.production | hook protect-env"
probe "Write on .env.example" green "tool Write file_path /repo/.env.example | hook protect-env"
probe "Read on .env.local" red "tool Read file_path /repo/.env.local | hook protect-env"
probe "Grep in .env" red "tool Grep path .env | hook protect-env"
probe "Read on a template .env.production.example" green "tool Read file_path /repo/x/.env.production.example | hook protect-env"
probe "Read on a file with env in its name" green "tool Read file_path /repo/docs/env.md | hook protect-env"
probe "Bash passes here; guard-shell holds it" green "tool Bash command 'cat .env' | hook protect-env"
probe "a broken library makes it reject" red "echo 'export function (' > scripts/lib/hooks/read-hook-input.ts; tool Write file_path /repo/.env.example | hook protect-env"

echo
echo "── require-ticket ──────────────────────────────────────────────────────"
probe "a protected path without a package" red "tool Write file_path scripts/x.ts | hook require-ticket"
probe "the reason names the way out" green "tool Write file_path scripts/x.ts | hook require-ticket 2>&1 | grep -q '/code PIX-N'; [ \${PIPESTATUS[1]} -eq 2 ]"
probe "a rule is protected, Markdown or not" red "tool Write file_path .claude/rules/x.md | hook require-ticket"
probe "CLAUDE.md is protected" red "tool Write file_path CLAUDE.md | hook require-ticket"
probe "a test folder inside scripts is protected" red "tool Write file_path scripts/test/x.ts | hook require-ticket"
probe "the README stays free" green "tool Write file_path README.md | hook require-ticket"
probe "docs stay free" green "tool Write file_path docs/notes/x.txt | hook require-ticket"
probe "a test stays free" green "tool Write file_path packages/core/src/x.spec.ts | hook require-ticket"
probe "a path outside the repo stays free" green "tool Write file_path /tmp/elsewhere/x.ts | hook require-ticket"
probe "with an open package" green "$package; tool Write file_path scripts/x.ts | hook require-ticket"
probe "with a package from another branch" red "$package; git switch -q -c feat/pix-997-other; tool Write file_path scripts/x.ts | hook require-ticket"
probe "a forged package does not count" red \
	"$package; perl -pi -e 's/Probe/Forged/' .claude/state/ticket.\$CLAUDE_CODE_SESSION_ID.json; tool Write file_path scripts/x.ts | hook require-ticket"
probe "a broken state machine makes it reject" red "echo 'x(' > scripts/ticket.ts; $package; tool Write file_path scripts/x.ts | hook require-ticket"

echo
echo "── unblock-window and push-window ──────────────────────────────────────"
probe "/unblock with a reason opens the window" green \
	"prompt '/unblock check the build' | hook unblock-window >/dev/null; tool Write file_path scripts/x.ts | hook require-ticket 2>&1 | grep -q 'check the build'"
probe "/unblock without a reason opens nothing" red \
	"prompt '/unblock' | hook unblock-window >/dev/null; tool Write file_path scripts/x.ts | hook require-ticket"
probe "unblock mentioned mid-line opens nothing" red \
	"prompt 'we could /unblock this later' | hook unblock-window >/dev/null; tool Write file_path scripts/x.ts | hook require-ticket"
probe "/push opens the push window" green "prompt '/push' | hook push-window >/dev/null; node scripts/ticket.ts push-allowed"
probe "/push 8h opens it for 480 minutes" green \
	"prompt '/push 8h' | hook push-window | grep -q '480 minutes'; [ \${PIPESTATUS[1]} -eq 0 ]"
probe "push mentioned mid-line opens nothing" red "prompt 'do not push yet' | hook push-window >/dev/null; node scripts/ticket.ts push-allowed"
probe "no window without a prompt" red "node scripts/ticket.ts push-allowed"
probe "a window hook never blocks the prompt" green "printf 'no json' | hook push-window && printf 'no json' | hook unblock-window"

echo
echo "── session-start and session-end ───────────────────────────────────────"
probe "start names the missing package and the way" green \
	"prompt x | hook session-start > out.txt; grep -q 'No work package set' out.txt"
probe "start names an open package" green "$package; prompt x | hook session-start > out.txt; grep -q 'PIX-998 (bug)' out.txt"
probe "start warns when the history guard is not installed" green \
	"git config core.hooksPath /nonexistent; prompt x | hook session-start > out.txt; git config --unset core.hooksPath; grep -q 'not installed' out.txt"
probe "end closes the package of the session" green \
	"$package; prompt x | hook session-end; node scripts/ticket.ts show | grep -q 'no work package'"

echo
echo "── agent-guard ─────────────────────────────────────────────────────────"
probe "an agent from the table with its family" green "agent research opus | hook agent-guard"
probe "an agent from the table without a model" green "agent Explore '' | hook agent-guard"
probe "haiku as a parameter" red "agent research haiku | hook agent-guard"
probe "haiku as a full model ID" red "agent research claude-haiku-4-5 | hook agent-guard"
probe "an agent the harness pins to haiku" red "agent claude-code-guide '' | hook agent-guard"
probe "an agent without a row" red "agent invented opus | hook agent-guard"
probe "a call that overrides the table" red "agent Explore opus | hook agent-guard"
probe "a definition that drifts from the table" red \
	"mkdir -p .claude/agents && printf -- '---\nname: research\nmodel: fable\n---\n' > .claude/agents/research.md; agent research '' | hook agent-guard"
probe "the guard keeps no count; the harness limit does" green \
	"agent research opus | hook agent-guard && agent research opus | hook agent-guard && agent research opus | hook agent-guard"
probe "without the table every agent is unknown" red "rm .claude/data/model-routing.md; agent research opus | hook agent-guard"
probe "another tool passes" green "tool Read file_path x | hook agent-guard"

echo
echo "── gate-before-pr ──────────────────────────────────────────────────────"
pr='gh pr create --base main --title probe'
probe "a command that creates no pull request passes" green "tool Bash command 'gh pr view 4' | hook gate-before-pr"
probe "a pull request without a work package" red "tool Bash command \"\$pr\" | hook gate-before-pr"
probe "a pull request without a review record" red "$package; tool Bash command \"\$pr\" | hook gate-before-pr"
probe "a review record of another commit does not count" red \
	"$package; node scripts/ticket.ts review-done >/dev/null; git commit -q --allow-empty -m next; tool Bash command \"\$pr\" | hook gate-before-pr"
probe "package, review and the stage-2 escape" green \
	"$package; node scripts/ticket.ts review-done >/dev/null; tool Bash command \"PIX_SKIP_GATE=1 \$pr\" | hook gate-before-pr"
probe "the escape does not skip the review" red "$package; tool Bash command \"PIX_SKIP_GATE=1 \$pr\" | hook gate-before-pr"

echo
echo "── quality-guard ───────────────────────────────────────────────────────"
write() { mkdir -p "$(dirname "$1")" && printf '%s\n' "${@:2}" > "$1" && tool Write file_path "$1" | hook quality-guard; }
probe "a clean file passes" green "write scripts/lib/clean.ts '// clean.ts — a probe file.' 'export const value = 1;'"
probe "a German word is reported" red "write scripts/lib/word.ts '// word.ts — a probe file.' 'export const kartei = 1;'"
probe "a date in a comment is reported" red "write scripts/lib/date.ts '// date.ts — a probe file.' '// changed on 2026-09-18' 'export const value = 1;'"
probe "two value exports are reported" red "write scripts/lib/two.ts '// two.ts — a probe file.' 'export const a = 1;' 'export const b = 2;'"
probe "a file outside the repo is left alone" green "printf 'kartei' > /tmp/probe-outside.ts; tool Write file_path /tmp/probe-outside.ts | hook quality-guard"
probe "a broken library makes it report" red "echo 'export function (' > scripts/lib/hooks/read-hook-input.ts; tool Write file_path cspell.json | hook quality-guard"

echo
echo "── check-settings ──────────────────────────────────────────────────────"
probe "the real settings" green "node scripts/check-settings.ts"
probe "bypassPermissions as default mode" red \
	"node -e 'const f=\".claude/settings.json\",s=require(\"./\"+f);s.permissions.defaultMode=\"bypassPermissions\";require(\"fs\").writeFileSync(f,JSON.stringify(s))'; node scripts/check-settings.ts"
probe "bypass mode no longer disabled" red \
	"node -e 'const f=\".claude/settings.json\",s=require(\"./\"+f);delete s.permissions.disableBypassPermissionsMode;require(\"fs\").writeFileSync(f,JSON.stringify(s))'; node scripts/check-settings.ts"
probe "the agent limit lifted" red \
	"node -e 'const f=\".claude/settings.json\",s=require(\"./\"+f);s.env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=\"8\";require(\"fs\").writeFileSync(f,JSON.stringify(s))'; node scripts/check-settings.ts"
probe "the agent limit missing" red \
	"node -e 'const f=\".claude/settings.json\",s=require(\"./\"+f);delete s.env.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS;require(\"fs\").writeFileSync(f,JSON.stringify(s))'; node scripts/check-settings.ts"
probe "an allow rule outside the repo" red \
	"node -e 'const f=\".claude/settings.json\",s=require(\"./\"+f);s.permissions.allow=[\"Read(~/secrets/**)\"];require(\"fs\").writeFileSync(f,JSON.stringify(s))'; node scripts/check-settings.ts"
probe "an allow rule inside the repo" green \
	"node -e 'const f=\".claude/settings.json\",s=require(\"./\"+f);s.permissions.allow=[\"Bash(npm run test)\"];require(\"fs\").writeFileSync(f,JSON.stringify(s))'; node scripts/check-settings.ts"
probe "a hook file that is wired nowhere" red "cp .claude/hooks/agent-guard.ts .claude/hooks/orphan.ts; node scripts/check-settings.ts"
probe "a wired hook that does not exist" red "rm .claude/hooks/session-end.ts; node scripts/check-settings.ts"

echo
probe_done
