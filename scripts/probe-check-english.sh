#!/usr/bin/env bash
# probe-check-english.sh — rejects a check-english that lets a non-English word, comment or file name pass.
# cspell:ignore Entscheidung Kartei Lesen Liest Wir ein kunden nehmen xqz
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "probe-check-english.sh: not a git repository." >&2; exit 1; }
# shellcheck source=scripts/lib/probe.sh
source "$root/scripts/lib/probe.sh"
probe_tree_init check-english

mkdir -p "$work/scripts/lib" "$work/.cspell"
cp "$root/scripts/check-english.ts" "$work/scripts/"
cp "$root/scripts/lib/files-to-check.ts" "$work/scripts/lib/"
cp "$root/cspell.json" "$work/"
printf '%s\n' '# schema: probe words' 'Pixecutive' >"$work/.cspell/project-words.txt"
ln -s "$root/node_modules" "$work/node_modules"
echo "node_modules" >"$work/.gitignore"
probe_tree_commit

check='node scripts/check-english.ts'

echo "── Words ───────────────────────────────────────────────────────────────"
probe "English names and comments pass" green \
	"printf '%s\\n' '// Reads the record of one customer.' 'export const readRecord = (path: string): string => path;' > a.ts && $check a.ts"
probe "a German identifier is rejected" red \
	"printf '%s\\n' 'export const karteiLesen = 1;' > a.ts && $check a.ts"
probe "a German comment is rejected" red \
	"printf '%s\\n' '// Liest die Kartei ein' 'export const readAll = 1;' > a.ts && $check a.ts"
probe "an invented three-letter abbreviation is rejected" red \
	"printf '%s\\n' 'export const xqzValue = 1;' > a.ts && $check a.ts"
probe "a word from the project list passes" green \
	"printf '%s\\n' 'export const pixecutiveName = 1;' > a.ts && $check a.ts"
probe "German prose in Markdown is rejected" red \
	"printf '%s\\n' '# Entscheidung' '' 'Wir nehmen die Kartei.' > notes.md && $check notes.md"

echo
echo "── File names and modes ────────────────────────────────────────────────"
probe "a German file name is rejected" red \
	"printf '%s\\n' 'export const value = 1;' > kundenKartei.ts && $check kundenKartei.ts"
probe "--staged checks only staged files" green \
	"printf '%s\\n' 'export const karteiLesen = 1;' > bad.ts && printf '%s\\n' 'export const value = 1;' > good.ts && git add good.ts && $check --staged"
probe "--staged rejects a staged German identifier" red \
	"printf '%s\\n' 'export const karteiLesen = 1;' > bad.ts && git add bad.ts && $check --staged"

probe "a named path that does not exist is red, never skipped" red "node scripts/check-english.ts no/such/file.ts"

echo
probe_done
