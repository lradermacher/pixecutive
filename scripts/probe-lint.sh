#!/usr/bin/env bash
# probe-lint.sh — every lint rule of ADR 0005, ADR 0006 and the core rule red once on a planted violation, and the clean
# skeleton green, in a throwaway copy of the workspace packages.
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "probe-lint.sh: not a git repository." >&2; exit 1; }
# shellcheck source=scripts/lib/probe.sh
source "$root/scripts/lib/probe.sh"
probe_tree_init lint

cp "$root/eslint.config.ts" "$root/tsconfig.base.json" "$root/package.json" "$work/"
for unit in "$root"/packages/* "$root"/apps/*; do
	name="${unit#"$root"/}"
	mkdir -p "$work/$name"
	cp -R "$unit/src" "$unit/package.json" "$unit/tsconfig.json" "$work/$name/"
	[ -d "$unit/node_modules" ] && ln -s "$unit/node_modules" "$work/$name/node_modules"
done
ln -s "$root/node_modules" "$work/node_modules"
printf '%s\n' 'node_modules' >"$work/.gitignore"
probe_tree_commit

lint='node_modules/.bin/eslint --max-warnings 0'
core='packages/core/src/probe.ts'
plant() { printf '%s\n' "$@" >"$core"; }

echo "── the clean skeleton ──────────────────────────────────────────────────"
probe "every package lints clean" green "$lint packages apps"

echo
echo "── typing (ADR 0006) ───────────────────────────────────────────────────"
probe "any" red "plant 'export function f(a: any): number { return a; }' && $lint $core"
probe "a missing return type" red "plant 'export function f(a: number) { return a; }' && $lint $core"
probe "a non-null assertion" red "plant 'export function f(a: number[]): number { return a[0]!; }' && $lint $core"
probe "a union of string literals" red "plant \"export type Kind = 'desk' | 'chair';\" && $lint $core"
probe "an enum instead" green "plant 'export enum Kind { Desk = \"desk\", Chair = \"chair\" }' && $lint $core"
probe "a union of named types stays allowed" green \
	"plant 'export type Value = number | string;' && $lint $core"
probe "a function over 120 lines" red \
	"{ echo 'export function f(): number {'; echo '  let a = 0;'; for i in \$(seq 1 125); do echo '  a += 1;'; done; echo '  return a;'; echo '}'; } > $core && $lint $core"
probe "complexity above 12" red \
	"{ echo 'export function f(a: number): number {'; for i in \$(seq 1 13); do echo \"  if (a === \$i) return \$i;\"; done; echo '  return 0;'; echo '}'; } > $core && $lint $core"

echo
echo "── the core (core rule) ────────────────────────────────────────────────"
probe "new Date() in the core" red "plant 'export function f(): number { return new Date().getTime(); }' && $lint $core"
probe "Date.now() in the core" red "plant 'export function f(): number { return Date.now(); }' && $lint $core"
probe "Math.random() in the core" red "plant 'export function f(): number { return Math.random(); }' && $lint $core"
probe "throw new Error in the core" red "plant 'export function f(): never { throw new Error(\"x\"); }' && $lint $core"
probe "Date.now() in an app is allowed" green \
	"printf '%s\n' 'export function f(): number { return Date.now(); }' > apps/company-server/src/probe.ts && $lint apps/company-server/src/probe.ts"

echo
echo "── comments that switch rules off (ADR 0005 point 11) ──────────────────"
probe "eslint-disable without a reason" red \
	"plant '// eslint-disable-next-line @typescript-eslint/no-non-null-assertion' 'export function f(a: number[]): number { return a[0]!; }' && $lint $core"
probe "eslint-disable with a reason" green \
	"plant '// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- the probe needs it' 'export function f(a: number[]): number { return a[0]!; }' && $lint $core"
probe "an eslint-disable that disables nothing" red \
	"plant '// eslint-disable-next-line @typescript-eslint/no-explicit-any -- nothing to disable' 'export const a = 1;' && $lint $core"
probe "@ts-expect-error without a reason" red \
	"plant '// @ts-expect-error' 'export const a: number = \"x\";' && $lint $core"

probe_done
