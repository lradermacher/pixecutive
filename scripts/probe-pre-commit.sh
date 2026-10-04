#!/usr/bin/env bash
# probe-pre-commit.sh — the pre-commit hook on real commits in a throwaway repo, red once and green once per case:
# content, paths, identity, branch name, the gate table, and that the hook checks the commit, not the disk.
# cspell:ignore ATA
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "probe-pre-commit.sh: not a git repository." >&2; exit 1; }

# shellcheck source=scripts/lib/probe.sh
source "$root/scripts/lib/probe.sh"
probe_tree_init pre-commit

mkdir -p "$work/scripts/lib" "$work/.claude/data" "$work/gate-input"
cp "$root/scripts/pre-commit.ts" "$work/scripts/"
cp -R "$root/scripts/lib/guard" "$work/scripts/lib/"
# A table with one gate that fails whenever `gate-input/` is touched, so the probe depends on no real gate.
printf '%s\n' '---' 'schema: probe table' '---' '# trigger	command' \
	'^gate-input/	bash scripts/failing-gate.sh' '^scripts/probe-listed\.sh$	bash scripts/probe-listed.sh' >"$work/.claude/data/precommit-checks.tsv"
printf '%s\n' '#!/usr/bin/env bash' 'echo "⛔ probe gate is red"; exit 1' >"$work/scripts/failing-gate.sh"
echo "input" >"$work/gate-input/data.txt"
echo "start" >"$work/README.txt"
probe_tree_commit
git -C "$work" checkout -q -b feat/pix-1-probe
# The entry point sits outside the throwaway tree, so it shows up in no case's diff.
mkdir -p "$work/.git/probe-hooks"
cp "$root/.githooks/pre-commit" "$work/.git/probe-hooks/pre-commit"
chmod +x "$work/.git/probe-hooks/pre-commit"
git -C "$work" config core.hooksPath .git/probe-hooks
git -C "$work" config user.name probe
git -C "$work" config user.email probe@example.com
printf '%s\n' '{ "historyGuard": { "denylist": [{ "category": "codename", "pattern": "zebra-falcon" }] } }' >"$work/.probe-config.json"
PROBE_CLEAN_EXCLUDES=(.probe-config.json)
probe_env() { export PIXECUTIVE_LOCAL_CONFIG="$work/.probe-config.json"; }
probe_restore_extra() { git -C "$work" config user.email probe@example.com; }

commit='git commit -q -m probe'
# Assembled at run time, so this file itself carries neither a key nor a home path.
key="AKIA$(printf 'ABCDEFGHIJKLMNOP')"
home_path="/Us""ers/someone/project"
fallback="change""me"
host="$(hostname | tr '[:upper:]' '[:lower:]')"

echo "── Content ─────────────────────────────────────────────────────────────"
probe "a clean file passes" green \
	"echo ok > a.txt && git add a.txt && $commit"
probe "a key is rejected" red \
	"echo 'key = $key' > a.txt && git add a.txt && $commit"
probe "the report names file and line, never the key" green \
	"echo 'key = $key' > a.txt && git add a.txt && ! out=\$($commit 2>&1) && ! grep -q '$key' <<<\"\$out\" && grep -q 'a.txt:1' <<<\"\$out\""
openai="sk-$(printf 'a%.0s' $(seq 40))"
atlassian="ATA""TT3xFfGF0$(printf 'b%.0s' $(seq 30))"
credentials="postgres:/""/app:hunter22@db/x"
scratch="/private/tmp/claude-501/-Us""ers-someone-Code-x/"
probe "an OpenAI key is rejected" red "echo 'k = $openai' > a.txt && git add a.txt && $commit"
probe "an Atlassian token is rejected" red "echo 't = $atlassian' > a.txt && git add a.txt && $commit"
probe "a URL with a password is rejected" red "echo 'url = $credentials' > a.txt && git add a.txt && $commit"
probe "a URL without a password passes" green "echo 'url = https://example.org/x' > a.txt && git add a.txt && $commit"
probe "a scratchpad path with a user name is rejected" red "echo 'see $scratch' > a.txt && git add a.txt && $commit"
probe "a plain-text password fallback is rejected" red \
	"printf '%s\\n' \"const p = env.P ?? '$fallback';\" > a.ts && git add a.ts && $commit"
probe "a home path is rejected" red \
	"echo 'cd $home_path' > a.txt && git add a.txt && $commit"
probe "a placeholder home path passes" green \
	"echo 'cd /home/<user>/project' > a.txt && git add a.txt && $commit"
probe "a denylisted string is rejected, whatever its case" red \
	"echo 'Zebra-Falcon launch' > a.txt && git add a.txt && $commit"
probe "without a local config the commit passes and says so" green \
	"export PIXECUTIVE_LOCAL_CONFIG=\"\$PWD/missing.json\" && echo 'zebra-falcon' > a.txt && git add a.txt && out=\$($commit 2>&1) && grep -q 'No denylist' <<<\"\$out\""
probe "a local config in the repo root is applied" red \
	"unset PIXECUTIVE_LOCAL_CONFIG && printf '%s\\n' '{\"historyGuard\":{\"denylist\":[{\"category\":\"series\",\"pattern\":\"next-episode-twist\"}]}}' > pixecutive.local.json &&
	 echo 'Next-Episode-Twist' > a.txt && git add a.txt && $commit"
probe "in a linked worktree the main checkout's config applies" red \
	"unset PIXECUTIVE_LOCAL_CONFIG && printf '%s\\n' '{\"historyGuard\":{\"denylist\":[{\"category\":\"series\",\"pattern\":\"next-episode-twist\"}]}}' > pixecutive.local.json &&
	 git config core.hooksPath \"\$PWD/.git/probe-hooks\" && wt=\"\$(mktemp -d)/wt\" && git worktree add -q -b feat/pix-6-tree \"\$wt\" &&
	 (cd \"\$wt\" && echo 'Next-Episode-Twist' > a.txt && git add a.txt && $commit); rc=\$?; git worktree remove --force \"\$wt\"; git config core.hooksPath .git/probe-hooks; exit \$rc"
probe "the same worktree commit with clean content passes" green \
	"unset PIXECUTIVE_LOCAL_CONFIG && printf '%s\\n' '{\"historyGuard\":{\"denylist\":[{\"category\":\"series\",\"pattern\":\"next-episode-twist\"}]}}' > pixecutive.local.json &&
	 git config core.hooksPath \"\$PWD/.git/probe-hooks\" && wt=\"\$(mktemp -d)/wt\" && git worktree add -q -b feat/pix-7-tree \"\$wt\" &&
	 (cd \"\$wt\" && echo 'all fine' > a.txt && git add a.txt && $commit); rc=\$?; git worktree remove --force \"\$wt\"; git config core.hooksPath .git/probe-hooks; exit \$rc"
probe "a local config that is not valid JSON stops the commit" red \
	"echo '{ broken' > \"\$PIXECUTIVE_LOCAL_CONFIG.bad\" && export PIXECUTIVE_LOCAL_CONFIG=\"\$PIXECUTIVE_LOCAL_CONFIG.bad\" && echo ok > a.txt && git add a.txt && $commit"
probe "a denylist entry without a pattern stops the commit" red \
	"printf '%s\\n' '{\"historyGuard\":{\"denylist\":[{\"category\":\"x\"}]}}' > c.json && export PIXECUTIVE_LOCAL_CONFIG=\"\$PWD/c.json\" && echo ok > a.txt && git add a.txt && $commit"
probe "an invalid pattern stops the commit instead of matching nothing" red \
	"printf '%s\\n' '{\"historyGuard\":{\"denylist\":[{\"category\":\"x\",\"pattern\":\"a[\"}]}}' > c.json && export PIXECUTIVE_LOCAL_CONFIG=\"\$PWD/c.json\" && echo ok > a.txt && git add a.txt && $commit"
probe "a binary file is not read as text" green \
	"printf '\\000\\001%s' '$key' > a.bin && git add a.bin && $commit"
probe "an empty file passes" green \
	": > empty.txt && git add empty.txt && $commit"

echo
echo "── Paths ───────────────────────────────────────────────────────────────"
probe "an environment file is rejected" red \
	"echo A=1 > .env && git add .env && $commit"
probe "an environment example file passes" green \
	"echo A= > .env.example && git add .env.example && $commit"
probe "the local config forced into the commit is rejected" red \
	"echo '{}' > pixecutive.local.json && git add -f pixecutive.local.json && $commit"
probe "the local config example passes" green \
	"echo '{}' > pixecutive.local.example.json && git add pixecutive.local.example.json && $commit"

echo
echo "── Images ──────────────────────────────────────────────────────────────"
probe "a screenshot is rejected" red \
	"printf 'x' > shot.png && git add shot.png && $commit"
probe "a PNG asset under apps/web/assets passes" green \
	"mkdir -p apps/web/assets && printf 'x' > apps/web/assets/desk.png && git add apps/web && $commit"
probe "a JPEG asset is rejected" red \
	"mkdir -p apps/web/assets && printf 'x' > apps/web/assets/desk.jpg && git add apps/web && $commit"
probe "an asset above 256 KB is rejected" red \
	"mkdir -p apps/web/assets && head -c 300000 /dev/zero > apps/web/assets/desk.png && git add apps/web && $commit"

echo
echo "── Identity ────────────────────────────────────────────────────────────"
probe "a mail without a real domain is rejected" red \
	"git config user.email probe@probe && echo ok > a.txt && git add a.txt && $commit"
probe "a mail derived from a .local host is rejected" red \
	"git config user.email probe@machine.local && echo ok > a.txt && git add a.txt && $commit"
probe "a mail carrying this machine's host name is rejected" red \
	"git config user.email 'probe@$host' && echo ok > a.txt && git add a.txt && $commit"
probe "with configured authors an unlisted mail is rejected" red \
	"printf '%s\\n' '{\"historyGuard\":{\"authors\":[\"someone@example.org\"]}}' > c.json && export PIXECUTIVE_LOCAL_CONFIG=\"\$PWD/c.json\" && echo ok > a.txt && git add a.txt && $commit"
probe "with configured authors a listed mail passes, whatever its case" green \
	"printf '%s\\n' '{\"historyGuard\":{\"authors\":[\"someone@example.org\",\"Probe@Example.com\"]}}' > c.json && export PIXECUTIVE_LOCAL_CONFIG=\"\$PWD/c.json\" && echo ok > a.txt && git add a.txt && $commit"

echo
echo "── Branch ──────────────────────────────────────────────────────────────"
probe "a branch without its card is rejected" red \
	"git switch -q -c feat/probe && echo ok > a.txt && git add a.txt && $commit"
probe "a branch with an unknown type is rejected" red \
	"git switch -q -c feature/pix-3-probe && echo ok > a.txt && git add a.txt && $commit"
probe "a branch <type>/pix-NNN-short passes" green \
	"git switch -q -c fix/pix-3-two-words && echo ok > a.txt && git add a.txt && $commit"

echo
echo "── Gate table ──────────────────────────────────────────────────────────"
probe "a triggered red gate stops the commit" red \
	"echo changed >> gate-input/data.txt && git add gate-input/data.txt && $commit"
probe "deleting a gate's input triggers it as well" red \
	"git rm -q gate-input/data.txt && $commit"
probe "a gate that is not triggered does not run" green \
	"echo ok > a.txt && git add a.txt && $commit"
probe "a probe with a row in the table passes" green \
	"printf '#!/usr/bin/env bash\\n' > scripts/probe-listed.sh && git add scripts/probe-listed.sh && $commit"
probe "a probe without a row in the table is rejected" red \
	"printf '#!/usr/bin/env bash\\n' > scripts/probe-unlisted.sh && git add scripts/probe-unlisted.sh && $commit"
# Long commit: 4,000 paths, together far beyond the 64 KB of a pipe, before the triggering path. Through a pipe the
# path list broke off at the first hit and the gate silently did not run.
probe "a long commit still triggers its gate" red \
	"mkdir -p bulk && for n in \$(seq 1 4000); do printf 'x\\n' > bulk/file-with-a-rather-long-name-\$n.txt; done &&
	 git add bulk && echo changed >> gate-input/data.txt && git add gate-input/data.txt && $commit"

echo
echo "── The commit is checked, not the disk ─────────────────────────────────"
probe "staged clean, problem only in the working tree, passes" green \
	"echo ok > a.txt && git add a.txt && echo 'key = $key' >> a.txt && $commit"
probe "problem staged, already fixed in the working tree, is rejected" red \
	"echo 'key = $key' > a.txt && git add a.txt && echo ok > a.txt && $commit"
probe "after a red commit the working tree is unchanged" green \
	"echo note > untracked.txt && echo 'key = $key' > a.txt && git add a.txt && echo local >> README.txt &&
	 before=\"\$(git status --porcelain; shasum README.txt untracked.txt a.txt)\" && ! $commit >/dev/null 2>&1 &&
	 [ \"\$before\" = \"\$(git status --porcelain; shasum README.txt untracked.txt a.txt)\" ]"
probe "git commit <path> checks only that path" green \
	"echo 'key = $key' > bad.txt && git add bad.txt && echo ok > a.txt && git add a.txt && git commit -q -m probe -- a.txt"
probe "a path with non-ASCII characters is checked" red \
	"mkdir -p 'ü' && echo 'key = $key' > 'ü/a.txt' && git add 'ü/a.txt' && $commit"
probe "the first commit on an empty branch runs with the repo's tools" red \
	"git checkout -q --orphan feat/pix-2-empty && echo 'key = $key' > a.txt && git add a.txt && $commit"

echo
probe_done
