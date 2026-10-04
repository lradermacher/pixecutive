#!/usr/bin/env bash
# probe-commit-msg.sh — the commit-msg hook red once and green once per case, on a message file as git passes it.
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "probe-commit-msg.sh: not a git repository." >&2; exit 1; }

# shellcheck source=scripts/lib/probe.sh
source "$root/scripts/lib/probe.sh"
probe_tree_init commit-msg

mkdir -p "$work/.githooks" "$work/scripts"
cp "$root/.githooks/commit-msg" "$work/.githooks/commit-msg"
cp "$root/scripts/commit-msg.ts" "$work/scripts/"
mkdir -p "$work/scripts/lib" && cp -R "$root/scripts/lib/guard" "$work/scripts/lib/"
printf '%s\n' '{ "historyGuard": { "denylist": [{ "category": "codename", "pattern": "zebra-falcon" }] } }' >"$work/.probe-config.json"
probe_tree_commit

co='Co-Authored-By: Probe Model <probe@example.com>'
scissors='# ------------------------ >8 ------------------------'

# Every argument becomes one line of the message; then the hook runs on it.
check_msg() {
	printf '%s\n' "$@" >MSG
	.githooks/commit-msg MSG
}

echo "── Length ──────────────────────────────────────────────────────────────"
probe "1 text line and co-author pass" green \
	"check_msg 'feat(x): one' '' \"\$co\""
probe "2 text lines and co-author pass" green \
	"check_msg 'feat(x): one' '' 'two' '' \"\$co\""
probe "3 text lines are rejected" red \
	"check_msg 'feat(x): one' '' 'two' 'three' '' \"\$co\""
probe "6 text lines are rejected" red \
	"check_msg 'feat(x): one' '' 'two' 'three' 'four' '' 'five' 'six' '' \"\$co\""
probe "blank lines and # lines do not count" green \
	"check_msg '# head' 'feat(x): one' '' '' '# a' '# b' '# c' 'two' '' '' \"\$co\" '# foot'"
probe "everything from the scissors line on does not count" green \
	"check_msg 'feat(x): one' '' \"\$co\" \"\$scissors\" '# Do not modify' 'diff --git a/f b/f' '+a' '+b' '+c'"
probe "lines before the scissors line are still counted" red \
	"check_msg 'feat(x): one' '' 'two' 'three' '' \"\$co\" \"\$scissors\" '+a'"

echo
echo "── Co-author and prefix ────────────────────────────────────────────────"
probe "two co-author lines are rejected" red \
	"check_msg 'feat(x): one' '' \"\$co\" \"\$co\""
probe "without a co-author it is rejected" red \
	"check_msg 'feat(x): one'"
probe "without a prefix it is rejected" red \
	"check_msg 'one' '' \"\$co\""
probe "a ticket scope passes" green \
	"check_msg 'fix(pix-42): one' '' \"\$co\""

echo
echo "── Exceptions ──────────────────────────────────────────────────────────"
probe "a merge message with many lines passes" green \
	"check_msg 'Merge branch feat/x' '' 'a' 'b' 'c' 'd' 'e'"
probe "a fixup! with many lines passes" green \
	"check_msg 'fixup! feat(x): one' '' 'a' 'b' 'c'"

echo
echo "── What the history guard forbids ──────────────────────────────────────"
key="AKIA$(printf 'ABCDEFGHIJKLMNOP')"
probe "a denylisted word in the message is rejected" red "PIXECUTIVE_LOCAL_CONFIG=$work/.probe-config.json check_msg 'feat(x): ship zebra-falcon' '' \"\$co\""
probe "a key in the message is rejected" red "PIXECUTIVE_LOCAL_CONFIG=$work/.probe-config.json check_msg 'feat(x): one' '' \"key $key\" '' \"\$co\""
probe "a merge message with a denylisted word is rejected too" red "PIXECUTIVE_LOCAL_CONFIG=$work/.probe-config.json check_msg 'Merge zebra-falcon'"
probe "a clean message with the config passes" green "PIXECUTIVE_LOCAL_CONFIG=$work/.probe-config.json check_msg 'feat(x): one' '' \"\$co\""

echo
probe_done
