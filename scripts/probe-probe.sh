#!/usr/bin/env bash
# probe-probe.sh — rejects a broken scripts/lib/probe.sh: each case runs in a fresh bash that loads the frame. The
# counting here does not use the frame, so a broken `probe_record` cannot hide its own errors.
set -u

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
[ -n "$ROOT" ] || { echo "⛔ No repo root found"; exit 1; }
cd "$ROOT" || exit 1
LIB="$ROOT/scripts/lib/probe.sh"

passed=0
failed=0

# $1 description · $2 expected last line · $3 script that runs after `source` of the frame
check() {
	local label="$1" want="$2" body="$3" got
	got="$(bash -c "set -u; source '$LIB'; $body" 2>/dev/null | tail -1)"
	if [ "$got" = "$want" ]; then
		passed=$((passed + 1)); printf '  ✅ %-62s %s\n' "$label" "$got"
	else
		failed=$((failed + 1)); printf '  ⛔ %-62s »%s«, expected »%s«\n' "$label" "$got" "$want"
	fi
}

echo "── probe_record and probe_case ─────────────────────────────────────────"
check "the same result counts as passed" "1 0" \
	'probe_record a green green >/dev/null; echo "$PROBE_PASS $PROBE_FAIL"'
check "a different result counts as a deviation" "0 1" \
	'probe_record a red green >/dev/null; echo "$PROBE_PASS $PROBE_FAIL"'
check "exit 0 is green" "1 0" \
	'probe_case a green true >/dev/null; echo "$PROBE_PASS $PROBE_FAIL"'
check "a non-zero exit is red" "1 0" \
	'probe_case a red "exit 3" >/dev/null; echo "$PROBE_PASS $PROBE_FAIL"'
check "red expected, green received, is a deviation" "0 1" \
	'probe_case a red true >/dev/null; echo "$PROBE_PASS $PROBE_FAIL"'

echo "── probe_done ──────────────────────────────────────────────────────────"
check "without deviation exit 0" "0" \
	'(probe_record a green green; probe_done) >/dev/null; echo $?'
check "with a deviation exit 1" "1" \
	'(probe_record a red green; probe_done) >/dev/null; echo $?'

echo "── Throwaway tree ──────────────────────────────────────────────────────"
check "without a directory probe_tree_init aborts" "1" \
	'(TMPDIR=/nonexistent/probe probe_tree_init x) >/dev/null 2>&1; echo $?'
check "a case runs in the throwaway tree, not in the repo" "same" \
	'probe_tree_init x; probe_tree_commit; probe a green "[ \"\$(pwd -P)\" = \"\$(cd \"\$work\" && pwd -P)\" ]" >/dev/null; [ "$PROBE_PASS" = 1 ] && echo same'
check "CLAUDE_PROJECT_DIR points to the tree, even when it was set" "tree" \
	'export CLAUDE_PROJECT_DIR=/repo; probe_tree_init x; probe_tree_commit; probe a green "[ \"\$CLAUDE_PROJECT_DIR\" = \"\$work\" ]" >/dev/null; [ "$PROBE_PASS" = 1 ] && echo tree'
check "probe_env sets variables for the case" "env" \
	'probe_env() { export PROBE_X=1; }; probe_tree_init x; probe_tree_commit; probe a green "[ \"\${PROBE_X:-}\" = 1 ]" >/dev/null; [ "$PROBE_PASS" = 1 ] && echo env'
check "after the case a new file is gone" "clean" \
	'probe_tree_init x; probe_tree_commit; probe a green "touch new" >/dev/null; [ ! -e "$work/new" ] && echo clean'
check "after the case a changed file is restored" "restored" \
	'probe_tree_init x; echo old > "$work/f"; probe_tree_commit; probe a green "echo new > f" >/dev/null; [ "$(cat "$work/f")" = old ] && echo restored'
check "a case that switches branches ends on the base branch again" "base" \
	'probe_tree_init x; probe_tree_commit; b=$(git -C "$work" symbolic-ref --short HEAD); probe a green "git checkout -q -b other" >/dev/null; [ "$(git -C "$work" symbolic-ref --short HEAD)" = "$b" ] && echo base'
check "a case that commits on the base branch is reverted" "base" \
	'probe_tree_init x; probe_tree_commit; h=$(git -C "$work" rev-parse HEAD); probe a green "git -c user.email=p@example.com -c user.name=p commit -q --allow-empty -m next" >/dev/null; [ "$(git -C "$work" rev-parse HEAD)" = "$h" ] && echo base'
# A case before the first commit has no state to return to yet; the state is then remembered at the next case, not
# as an empty or literal name.
check "a case before the first commit does not switch off reverting" "base" \
	'probe_tree_init x; probe a green true >/dev/null; probe_tree_commit; h=$(git -C "$work" rev-parse HEAD); probe b green "git -c user.email=p@example.com -c user.name=p commit -q --allow-empty -m next" >/dev/null; [ "$(git -C "$work" rev-parse HEAD)" = "$h" ] && echo base'
check "PROBE_CLEAN_EXCLUDES keeps a path" "kept" \
	'probe_tree_init x; probe_tree_commit; PROBE_CLEAN_EXCLUDES=(stays); probe a green "touch stays" >/dev/null; [ -e "$work/stays" ] && echo kept'
check "PROBE_RESTORE=no leaves the tree as it is" "kept" \
	'PROBE_RESTORE=no; probe_tree_init x; probe_tree_commit; probe a green "touch new" >/dev/null; [ -e "$work/new" ] && echo kept'
check "probe_restore_extra runs after every case" "extra" \
	'probe_restore_extra() { echo extra > "$work/.mark"; }; probe_tree_init x; probe_tree_commit; probe a green true >/dev/null; [ -e "$work/.mark" ] && echo extra'
# Empty $work in a directory of its own with an untracked file: if `git clean` cleaned up there, the file would be
# gone. In the repo the same error would be a total loss.
check "an empty \$work aborts probe_restore instead of cleaning up" "1 kept" \
	'd="$(mktemp -d)"; git -C "$d" init -q; touch "$d/untracked"; code=$(cd "$d" && (work=""; probe_restore) >/dev/null 2>&1; echo $?); [ -e "$d/untracked" ] && echo "$code kept"; rm -rf "${d:?}"'
# A pre-commit sets GIT_INDEX_FILE, absolute with `git commit -a`; together with GIT_DIR every git call on the
# throwaway tree would write into the repo that is committing.
check "from a pre-commit the repo's index and HEAD stay untouched" "untouched" \
	'd="$(mktemp -d)"; git -C "$d" init -q; echo a > "$d/f"; git -C "$d" add f; git -C "$d" -c user.email=p@example.com -c user.name=p commit -qm a; i=$(cksum < "$d/.git/index"); h=$(git -C "$d" rev-parse HEAD); GIT_DIR="$d/.git" GIT_INDEX_FILE="$d/.git/index" bash -c "source '"'$LIB'"'; probe_tree_init x; echo b > \"\$work/g\"; probe_tree_commit; probe a green \"echo c > h; git add -A; git -c user.email=p@example.com -c user.name=p commit -qm c\"" >/dev/null 2>&1; [ "$(cksum < "$d/.git/index")" = "$i" ] && [ "$(git -C "$d" rev-parse HEAD)" = "$h" ] && echo untouched; rm -rf "${d:?}"'
check "from a hook the outer commit's identity does not reach the case" "own" \
	'GIT_AUTHOR_EMAIL=outer@example.org GIT_COMMITTER_EMAIL=outer@example.org bash -c "source '"'$LIB'"'; probe_tree_init x; git -C \"\$work\" config user.email own@example.com; git -C \"\$work\" var GIT_AUTHOR_IDENT" | grep -q "<own@example.com>" && echo own'
check "on EXIT the tree is gone" "gone" \
	'dir="$(bash -c "source '"'$LIB'"'; probe_tree_init x; echo \$work")"; [ -n "$dir" ] && [ ! -e "$dir" ] && echo gone'
check "on EXIT probe_cleanup_extra runs" "extra" \
	'mark="$(mktemp)"; bash -c "source '"'$LIB'"'; probe_cleanup_extra() { echo extra > \"$mark\"; }; probe_tree_init x"; cat "$mark"; rm -f "$mark"'

echo
echo "$passed probes as expected, $failed deviating."
[ "$failed" -eq 0 ]
