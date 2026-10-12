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
probe "new globalThis.Date() in the core" red "plant 'export function f(): number { return new globalThis.Date().getTime(); }' && $lint $core"
probe "globalThis.Date.now() in the core" red "plant 'export function f(): number { return globalThis.Date.now(); }' && $lint $core"
probe "crypto.randomUUID() in the core" red "plant 'export function f(): string { return crypto.randomUUID(); }' && $lint $core"
probe "crypto.getRandomValues() in the core" red "plant 'export function f(): Uint8Array { return crypto.getRandomValues(new Uint8Array(4)); }' && $lint $core"
probe "performance.now() in the core" red "plant 'export function f(): number { return performance.now(); }' && $lint $core"
probe "globalThis.crypto.randomUUID() in the core" red "plant 'export function f(): string { return globalThis.crypto.randomUUID(); }' && $lint $core"
probe "crypto.randomUUID() in an app is allowed" green \
	"printf '%s\\n' 'export function f(): string { return crypto.randomUUID(); }' > apps/company-server/src/probe.ts && $lint apps/company-server/src/probe.ts"
probe "Math.random() in the core" red "plant 'export function f(): number { return Math.random(); }' && $lint $core"
probe "throw new Error in the core" red "plant 'export function f(): never { throw new Error(\"x\"); }' && $lint $core"
infra='packages/infrastructure/src/adapter/Probe/probe-fake.adapter.ts'
probe "throw new Error in an adapter" red \
	"mkdir -p \$(dirname $infra) && printf '%s\\n' 'export function f(): never { throw new Error(\"x\"); }' > $infra && $lint $infra"
probe "a rejection with a plain Error in an adapter" red \
	"mkdir -p \$(dirname $infra) && printf '%s\\n' 'export const f = (): Promise<never> => Promise.reject(new Error(\"x\"));' > $infra && $lint $infra"
probe "a plain Error in an adapter spec stays allowed" green \
	"mkdir -p \$(dirname $infra) && printf '%s\\n' 'export const f = (): Error => new TypeError(\"x\");' > \${infra%.ts}.spec.ts && $lint \${infra%.ts}.spec.ts"
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

echo
echo "── import zones (ADR 0006 point 8, ADR 0018) ───────────────────────────"
at() { mkdir -p "$(dirname "$1")" && printf '%s\n' "${@:2}" >"$1"; }
domain='packages/core/src/domain/probe.ts'
service='packages/core/src/application/service/probe.ts'
# Red only when the zone rule itself reports; another lint error would hide a hole in the zones.
# Green with it means only that the zones allow the import; the cases that need a clean file use $lint.
zone() { local out; out="$($lint "$1" 2>&1)"; case "$out" in *boundaries/dependencies*) return 1 ;; esac; }
probe "the domain imports a service" red \
	"at $service 'export const s = 1;' && at $domain \"import { s } from '../application/service/probe.ts';\" 'export const d = s;' && zone $domain"
probe "a service imports the domain" green \
	"at $domain 'export const d = 1;' && at $service \"import { d } from '../../domain/probe.ts';\" 'export const s = d;' && $lint $service"
for form in static dynamic require; do
	case "$form" in
	static) fs="import { readFileSync } from 'node:fs'; export const f = readFileSync;" ;;
	dynamic) fs="export async function f(): Promise<unknown> { return import('node:fs'); }" ;;
	require) fs="declare const require: (id: string) => unknown; export const f = require('node:fs');" ;;
	esac
	probe "the core imports node:fs ($form)" red "at $domain \"$fs\" && zone $domain"
	probe "the core imports the infrastructure ($form)" red \
		"at $domain \"$(printf '%s' "$fs" | sed 's#node:fs#@pixecutive/infrastructure#')\" && zone $domain"
	probe "the office UI imports the core ($form)" red \
		"at apps/office-ui/src/probe.ts \"$(printf '%s' "$fs" | sed 's#node:fs#@pixecutive/core#')\" && zone apps/office-ui/src/probe.ts"
	probe "the office UI imports node:fs ($form)" red "at apps/office-ui/src/probe.ts \"$fs\" && zone apps/office-ui/src/probe.ts"
done
probe "the core imports a framework package" red "at $domain \"import { it } from 'vitest';\" 'export const n = it;' && zone $domain"
probe "the infrastructure imports an app" red \
	"at packages/infrastructure/src/probe.ts \"import { packageName } from '../../../apps/company-server/src/index.ts';\" 'export const n = packageName;' && zone packages/infrastructure/src/probe.ts"
probe "the infrastructure imports the core" green \
	"at packages/infrastructure/src/probe.ts \"import { packageName } from '@pixecutive/core';\" 'export const n = packageName;' && $lint packages/infrastructure/src/probe.ts"
probe "the asset pipeline imports the infrastructure" green \
	"at apps/asset-pipeline/src/probe.ts \"import { packageName } from '@pixecutive/infrastructure';\" 'export const n = packageName;' && $lint apps/asset-pipeline/src/probe.ts"
probe "the company server uses node:child_process" green \
	"at apps/company-server/src/probe.ts \"import { spawn } from 'node:child_process';\" 'export const n = spawn;' && $lint apps/company-server/src/probe.ts"
probe "the office UI imports the protocol" green \
	"at apps/office-ui/src/probe.ts \"import { packageName } from '@pixecutive/protocol';\" 'export const n = packageName;' && $lint apps/office-ui/src/probe.ts"

echo
echo "── other TypeScript forms and rare core forms (review run 1) ────────────"
probe "the office UI imports the core from a .tsx file" red \
	"at apps/office-ui/src/view.tsx \"export * from '@pixecutive/core';\" && zone apps/office-ui/src/view.tsx"
probe "the core imports node:fs from a .mts file" red "at packages/core/src/domain/io.mts \"export * from 'node:fs';\" && zone packages/core/src/domain/io.mts"
probe "Date.now() in a core .tsx file" red "at packages/core/src/domain/clock.tsx 'export const now = (): number => Date.now();' && $lint packages/core/src/domain/clock.tsx"
probe "a computed import() in the core" red "at $domain 'export const load = async (): Promise<unknown> => import(\`node:\${\"fs\"}\`);' && $lint $domain"
probe "throw new RangeError in the core" red "at $domain 'export function f(): never { throw new RangeError(\"x\"); }' && $lint $domain"
probe "throw Error() without new in the core" red "at $domain 'export function f(): never { throw Error(\"x\"); }' && $lint $domain"
probe "Date() without new in the core" red "at $domain 'export const d = (): string => Date();' && $lint $domain"
probe "the core imports zod, its one library" green "at $domain \"import { z } from 'zod';\" 'export const s = z.string();' && zone $domain"
probe "the core imports any other library" red "at $domain \"import { format } from 'prettier';\" 'export const f = format;' && zone $domain"
probe "a union of template literals" red "at $domain 'export type K = \`a\` | \`b\`;' && $lint $domain"
probe "the domain imports a core exception" green \
	"at packages/core/src/application/exception/probe.ts 'export const key = 1;' && at $domain \"import { key } from '../application/exception/probe.ts';\" 'export const d = key;' && $lint $domain"
probe "the infrastructure imports the protocol" green \
	"at packages/infrastructure/src/probe.ts \"import { packageName } from '@pixecutive/protocol';\" 'export const n = packageName;' && zone packages/infrastructure/src/probe.ts"

probe "a core exception of its own named …Error" green \
	"at $service 'export class DeskNotFoundError extends Error {}' 'export function f(): never { throw new DeskNotFoundError(\"desk\"); }' && $lint $service"

probe_done
