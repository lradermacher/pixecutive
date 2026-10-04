#!/usr/bin/env bash
# probe-tests.sh — check-tests red on a changed unit without its spec and green when the spec changes with it, for the
# staged commit and for a branch against main, in a throwaway repo.
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "probe-tests.sh: not a git repository." >&2; exit 1; }
# shellcheck source=scripts/lib/probe.sh
source "$root/scripts/lib/probe.sh"
probe_tree_init tests

mkdir -p "$work/scripts" "$work/packages/core/src/domain" "$work/packages/core/src/port/outgoing"
cp "$root/scripts/check-tests.ts" "$work/scripts/"
printf '%s\n' 'export function desk(): number { return 1; }' >"$work/packages/core/src/domain/desk.ts"
printf '%s\n' 'export const deskTest = 1;' >"$work/packages/core/src/domain/desk.spec.ts"
git -C "$work" checkout -q -b main
probe_tree_commit
git -C "$work" checkout -q -b feat/probe
PROBE_BASE_BRANCH=feat/probe
PROBE_BASE_SHA="$(git -C "$work" rev-parse HEAD)"

check='node scripts/check-tests.ts'
unit='packages/core/src/domain/desk.ts'
spec='packages/core/src/domain/desk.spec.ts'
touch_unit() { printf '%s\n' 'export function desk(): number { return 2; }' >"$unit"; }
touch_spec() { printf '%s\n' 'export const deskTest = 2;' >"$spec"; }
commit() { git add -A && git -c user.email=probe@example.com -c user.name=Probe commit -q -m step; }

echo "── the staged commit ───────────────────────────────────────────────────"
probe "a unit with its spec" green "touch_unit && touch_spec && git add -A && $check --staged"
probe "a unit without its spec" red "touch_unit && git add -A && $check --staged"
probe "only the spec" green "touch_spec && git add -A && $check --staged"
probe "a new unit without a spec" red \
	"printf '%s\n' 'export const chair = (): number => 1;' > packages/core/src/domain/chair.ts && git add -A && $check --staged"
probe "a new unit in a .tsx file without a spec" red \
	"printf '%s\n' 'export function Desk(): number { return 1; }' > packages/core/src/domain/desk-view.tsx && git add -A && $check --staged"
probe "a file of constants and types needs no spec" green \
	"printf '%s\n' 'export const size = 2;' 'export type Size = number;' 'export enum Kind { Desk = \"desk\" }' > packages/core/src/domain/size.ts && git add -A && $check --staged"
probe "a barrel that only re-exports needs no spec" green \
	"printf '%s\n' \"export * from './domain/desk.ts';\" > packages/core/src/barrel.ts && git add -A && $check --staged"
probe "a port interface needs no spec" green \
	"mkdir -p packages/core/src/port/outgoing && printf '%s\n' 'export interface IDesk { n: number; }' > packages/core/src/port/outgoing/desk.interface.ts && git add -A && $check --staged"
probe "a port token needs no spec" green \
	"mkdir -p packages/core/src/port/outgoing && printf '%s\n' 'export const DESK = Symbol();' > packages/core/src/port/outgoing/desk.token.ts && git add -A && $check --staged"
probe "tooling is out of scope" green "printf '%s\n' 'export const t = 1;' > scripts/tool.ts && git add -A && $check --staged"

echo
echo "── the branch against main ─────────────────────────────────────────────"
probe "a branch commit with the unit and its spec" green "touch_unit && touch_spec && commit && $check --all"
probe "a branch commit with the unit alone" red "touch_unit && commit && $check --all"
probe "the spec in a later commit of the branch" green "touch_unit && commit && touch_spec && commit && $check --all"
probe "main itself has nothing changed" green "git checkout -q main && $check --all"
probe "without a main to compare against it is red, not empty" red "git branch -q -m main old-main && $check --all"

echo
echo "── named paths ─────────────────────────────────────────────────────────"
probe "a named unit without its spec" red "$check $unit"
probe "a named unit with its spec" green "$check $unit $spec"

echo
probe_done
