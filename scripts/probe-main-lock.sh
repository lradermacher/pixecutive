#!/usr/bin/env bash
# probe-main-lock.sh — the hooks scripts/install-git-hooks.sh installs, red once and green once per case: no commit on
# main or a detached HEAD, no push that moves main, no push from an agent session without the push window.
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "probe-main-lock.sh: not a git repository." >&2; exit 1; }

# shellcheck source=scripts/lib/probe.sh
source "$root/scripts/lib/probe.sh"
probe_tree_init main-lock

mkdir -p "$work/scripts"
cp "$root/scripts/install-git-hooks.sh" "$work/scripts/"
echo "start" >"$work/README.txt"
probe_tree_commit
git -C "$work" branch -M main
git init -q --bare "$work/.remote.git"
git -C "$work" remote add origin "$work/.remote.git"
git -C "$work" push -q origin main 2>/dev/null
(cd "$work" && bash scripts/install-git-hooks.sh >/dev/null) || { echo "probe-main-lock.sh: install failed." >&2; exit 1; }
PROBE_CLEAN_EXCLUDES=(.remote.git)
# The probe may itself run inside an agent session; only the session case sets the variable.
probe_env() {
	unset CLAUDE_CODE_SESSION_ID
	git config user.email probe@example.com
	git config user.name probe
}

commit='git commit -q --allow-empty -m probe'

echo "── Install ─────────────────────────────────────────────────────────────"
probe "core.hooksPath points to the shared hooks-active folder" green \
	"[ \"\$(cd \"\$(git config core.hooksPath)\" && pwd -P)\" = \"\$(cd \"\$(git rev-parse --git-common-dir)\" && pwd -P)/hooks-active\" ]"
probe "every client hook has a forwarder" green \
	"for h in pre-commit pre-push commit-msg post-commit pre-rebase; do [ -x \"\$(git config core.hooksPath)/\$h\" ] || exit 1; done"
probe "outside a git repository the install fails loudly" red \
	"cd \"\$(mktemp -d)\" && bash '$work/scripts/install-git-hooks.sh'"

echo
echo "── Commits ─────────────────────────────────────────────────────────────"
probe "a commit on main is rejected" red "$commit"
probe "a commit on a feature branch passes" green "git switch -q -c feat/pix-1-probe && $commit"
probe "a commit on a detached HEAD is rejected" red "git switch -q --detach && $commit"

echo
echo "── Pushes ──────────────────────────────────────────────────────────────"
# A push with nothing new never reaches the hook, so main first gets a commit, built below the hooks with commit-tree.
probe "pushing main is rejected" red \
	"git update-ref refs/heads/main \"\$(git commit-tree 'HEAD^{tree}' -p HEAD -m probe)\" && git push -q origin main"
probe "pushing a branch onto main is rejected" red "git switch -q -c feat/pix-2-probe && $commit && git push -q origin HEAD:main"
probe "deleting main on the remote is rejected" red "git push -q origin :main"
probe "pushing a feature branch from a terminal passes" green "git switch -q -c feat/pix-3-probe && $commit && git push -q origin feat/pix-3-probe"
probe "pushing from a Claude session without a push window is rejected" red \
	"git switch -q -c feat/pix-4-probe && $commit && CLAUDE_CODE_SESSION_ID=probe git push -q origin feat/pix-4-probe"

echo
probe_done
