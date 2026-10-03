#!/usr/bin/env bash
# probe-verify-full.sh — scripts/verify-full.ts red once and green once per case, against package scripts and gates
# that only exit, so the probe measures stage 2's logic, not the project's code.
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "probe-verify-full.sh: not a git repository." >&2; exit 1; }

# shellcheck source=scripts/lib/probe.sh
source "$root/scripts/lib/probe.sh"
probe_tree_init verify-full

mkdir -p "$work/scripts" "$work/packages/probe"
cp "$root/scripts/verify-full.ts" "$work/scripts/"
echo '{ "name": "probe-package" }' >"$work/packages/probe/package.json"
probe_tree_commit

# Writes a package.json whose scripts exit with the given codes, `-` for a missing one: lint, format:check, typecheck,
# test.
scripts() {
	node -e 'const [l, f, t, s] = process.argv.slice(1);
		const scripts = {};
		for (const [k, v] of [["lint", l], ["format:check", f], ["typecheck", t], ["test", s]]) if (v !== "-") scripts[k] = "exit " + v;
		require("fs").writeFileSync("package.json", JSON.stringify({ name: "probe", private: true, scripts }) + "\n");' "$@"
	git add -A && git -c user.email=probe@example.com -c user.name=probe commit -q -m scripts
}
stage2='node scripts/verify-full.ts'
run="VERIFY_FULL_AGAIN=1 $stage2"

echo "── Steps ───────────────────────────────────────────────────────────────"
probe "without package.json the typecheck is missing and it is red" red "$run"
probe "before the first package only the typecheck is required" green "git rm -q -r packages && scripts - - 0 - && $run"
probe "all four scripts green is green" green "scripts 0 0 0 0 && $run"
probe "a red lint is red" red "scripts 1 0 0 0 && $run"
probe "a red typecheck is red" red "scripts 0 0 1 0 && $run"
probe "a red test is red" red "scripts 0 0 0 1 && $run"
probe "a missing script is red, never skipped" red "scripts 0 - 0 0 && $run"
probe "a red check-* gate is red" red "echo 'process.exit(1);' > scripts/check-probe.ts && scripts 0 0 0 0 && $run"

echo
echo "── Green mark ──────────────────────────────────────────────────────────"
probe "a clean tree checked green is not checked again" green \
	"scripts 0 0 0 0 && $stage2 >/dev/null && $stage2 | grep -q 'already checked green'"
probe "a changed tree is checked again" green \
	"scripts 0 0 0 0 && $stage2 >/dev/null && echo x > new.txt && ! $stage2 | grep -q 'already checked green'"

echo
probe_done
