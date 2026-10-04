#!/usr/bin/env bash
# probe-pre-push.sh — the pre-push hook red once and green once per case, in a throwaway repo with an empty remote.
# Stage 2 is a stub whose exit the case sets, so the probe measures the hook, not the project.
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "probe-pre-push.sh: not a git repository." >&2; exit 1; }

# shellcheck source=scripts/lib/probe.sh
source "$root/scripts/lib/probe.sh"
probe_tree_init pre-push

mkdir -p "$work/.githooks" "$work/scripts/lib"
cp "$root/.githooks/pre-push" "$work/.githooks/pre-push"
cp "$root/scripts/pre-push.ts" "$work/scripts/"
cp -R "$root/scripts/lib/guard" "$work/scripts/lib/"
printf '%s\n' "process.exit(Number(process.env['STAGE2_EXIT'] ?? 0));" >"$work/scripts/verify-full.ts"
echo "start" >"$work/README.txt"
probe_tree_commit
git -C "$work" checkout -q -b feat/probe
git init -q --bare "$work/.remote.git"
git -C "$work" remote add origin "$work/.remote.git"
git -C "$work" push -q origin feat/probe 2>/dev/null
printf '%s\n' '{ "historyGuard": { "denylist": [{ "category": "codename", "pattern": "zebra-falcon" }] } }' >"$work/.probe-config.json"
PROBE_CLEAN_EXCLUDES=(.remote.git .probe-config.json)
probe_env() { export PIXECUTIVE_LOCAL_CONFIG="$work/.probe-config.json"; }

# Git passes the hook one line per ref; `push` builds it for the current branch against origin.
zero="0000000000000000000000000000000000000000"
push='printf "refs/heads/feat/probe %s refs/heads/feat/probe %s\n" "$(git rev-parse HEAD)" "$(git rev-parse origin/feat/probe)" | .githooks/pre-push'
commit='git -c user.email=probe@example.com -c user.name=probe commit -q -a -m'
# Assembled at run time, so this file itself carries neither a key nor a home path.
key="AKIA$(printf 'ABCDEFGHIJKLMNOP')"
home_path="/Us""ers/someone/project"

echo "── History scan ────────────────────────────────────────────────────────"
probe "a clean commit passes" green \
	"echo new >> README.txt && $commit clean && $push"
probe "a commit with a key is rejected" red \
	"echo 'key = $key' >> README.txt && $commit secret && $push"
probe "the report names the place, never the key" green \
	"echo 'key = $key' >> README.txt && $commit secret && ! out=\$($push 2>&1) && ! grep -q '$key' <<<\"\$out\" && grep -q README.txt <<<\"\$out\""
probe "a key removed by a later commit is still a finding" red \
	"echo 'key = $key' >> README.txt && $commit secret && git checkout -q HEAD~1 -- README.txt && $commit gone && $push"
probe "a key in a Markdown file is a finding too" red \
	"echo 'example: $key' > NOTES.md && git add NOTES.md && $commit docs && $push"
probe "a home path is rejected" red \
	"echo 'cd $home_path' >> README.txt && $commit path && $push"
probe "a placeholder home path passes" green \
	"echo 'cd /home/<user>/project' >> README.txt && $commit path && $push"
probe "a denylisted string is rejected" red \
	"echo 'Zebra-Falcon launch' >> README.txt && $commit plan && $push"
probe "an environment file is rejected, its example is not" red \
	"echo A=1 > .env.local && git add .env.local && $commit env && $push"
probe "an environment example file passes" green \
	"echo A= > .env.example && git add .env.example && $commit env && $push"
probe "an image outside apps/web/assets is rejected" red \
	"printf 'x' > shot.png && git add shot.png && $commit image && $push"
probe "an oversized asset deleted again is still rejected" red \
	"mkdir -p apps/web/assets && head -c 300000 /dev/zero > apps/web/assets/big.png && git add apps/web && $commit big &&
	 git rm -q apps/web/assets/big.png && $commit gone && $push"
probe "a small PNG asset passes" green \
	"mkdir -p apps/web/assets && printf 'x' > apps/web/assets/desk.png && git add apps/web && $commit asset && $push"
probe "a denylisted word in a commit message is rejected" red \
	"echo new >> README.txt && git -c user.email=probe@example.com -c user.name=probe commit -q -a -m 'ship Zebra-Falcon' && $push"
probe "a new branch without a remote counterpart is scanned too" red \
	"git checkout -q -b feat/new && echo 'key = $key' >> README.txt && $commit secret &&
	 printf 'refs/heads/feat/new %s refs/heads/feat/new $zero\n' \"\$(git rev-parse HEAD)\" | .githooks/pre-push"
probe "deleting a ref carries no commits" green \
	"printf 'refs/heads/feat/old $zero refs/heads/feat/old %s\n' \"\$(git rev-parse HEAD)\" | .githooks/pre-push"
probe "without the pattern file it is rejected, not left unchecked" red \
	"rm -f scripts/lib/guard/secret-patterns.ts && echo new >> README.txt && $commit clean && $push"

echo
echo "── Stage 2 ─────────────────────────────────────────────────────────────"
probe "a red stage 2 rejects the push" red \
	"echo new >> README.txt && $commit clean && export STAGE2_EXIT=1 && $push"
# A pure deletion carries no code out; stage 2 does not run then, even if it would be red.
probe "a push that only deletes does not run stage 2" green \
	"export STAGE2_EXIT=1 && printf 'refs/heads/feat/old $zero refs/heads/feat/old %s\\n' \"\$(git rev-parse HEAD)\" | .githooks/pre-push"
probe "a new branch without own commits does not run stage 2" green \
	"export STAGE2_EXIT=1 && printf 'refs/heads/feat/copy %s refs/heads/feat/copy $zero\\n' \"\$(git rev-parse origin/feat/probe)\" | .githooks/pre-push"
probe "without verify-full.ts it is rejected" red \
	"rm -f scripts/verify-full.ts && echo new >> README.txt && $commit clean && $push"

echo
probe_done
