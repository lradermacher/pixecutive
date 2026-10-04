#!/usr/bin/env bash
# probe-check-one-export.sh — rejects a check-one-export that lets a second value export pass without its marker.
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "probe-check-one-export.sh: not a git repository." >&2; exit 1; }
# shellcheck source=scripts/lib/probe.sh
source "$root/scripts/lib/probe.sh"
probe_tree_init check-one-export

mkdir -p "$work/scripts/lib"
cp "$root/scripts/check-one-export.ts" "$work/scripts/"
cp "$root/scripts/lib/files-to-check.ts" "$work/scripts/lib/"
probe_tree_commit

check='node scripts/check-one-export.ts'

probe "one value export passes" green \
	"printf '%s\\n' 'export const first = 1;' > a.ts && $check a.ts"
probe "two value exports are rejected" red \
	"printf '%s\\n' 'export const first = 1;' 'export function second(): number { return 2; }' > a.ts && $check a.ts"
probe "two value exports with an aggregate marker pass" green \
	"printf '%s\\n' '/** @aggregate Two halves of one range. */' 'export const first = 1;' 'export const second = 2;' > a.ts && $check a.ts"
probe "a marker without a reason does not count" red \
	"printf '%s\\n' '/** @aggregate */' 'export const first = 1;' 'export const second = 2;' > a.ts && $check a.ts"
probe "type exports are free" green \
	"printf '%s\\n' 'export type A = number;' 'export interface B { b: number }' 'export const first = 1;' > a.ts && $check a.ts"
probe "a spec file is out of scope" green \
	"printf '%s\\n' 'export const first = 1;' 'export const second = 2;' > a.spec.ts && $check a.spec.ts"
probe "the browser UI is out of scope" green \
	"mkdir -p apps/web && printf '%s\\n' 'export const first = 1;' 'export const second = 2;' > apps/web/a.ts && $check apps/web/a.ts"
probe "--staged rejects a staged file with two value exports" red \
	"printf '%s\\n' 'export const first = 1;' 'export const second = 2;' > a.ts && git add a.ts && $check --staged"

probe "a named path that does not exist is red, never skipped" red "node scripts/check-one-export.ts no/such/file.ts"

echo
probe_done
