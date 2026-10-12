#!/usr/bin/env bash
# probe-architecture.sh — the architecture guard red on every planted break of the hexagon and green on the allowed
# writes, fed the JSON the harness sends, in a throwaway repo.
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$root" ] || { echo "probe-architecture.sh: not a git repository." >&2; exit 1; }
# shellcheck source=scripts/lib/probe.sh
source "$root/scripts/lib/probe.sh"
probe_tree_init architecture

mkdir -p "$work/.claude/hooks" "$work/scripts/lib" "$work/packages/core/src/port/outgoing" "$work/packages/infrastructure/src/adapter/Desk"
cp "$root/.claude/hooks/architecture-guard.ts" "$work/.claude/hooks/"
cp -R "$root/scripts/lib/hooks" "$root/scripts/lib/architecture" "$work/scripts/lib/"
printf '%s\n' 'export interface IDeskRepository { count(): number; }' >"$work/packages/core/src/port/outgoing/deskRepository.interface.ts"
printf '%s\n' 'export const value = 1;' >"$work/packages/core/src/domain.ts"
probe_tree_commit
export CLAUDE_PROJECT_DIR="$work"

guard() { node .claude/hooks/architecture-guard.ts; }
# write <path> <content> — the JSON of a Write call.
write() { node -e 'process.stdout.write(JSON.stringify({ tool_name: "Write", tool_input: { file_path: process.argv[1], content: process.argv[2] } }))' "$1" "$2"; }
# edit <path> <old> <new> — the JSON of an Edit call.
edit() {
	node -e 'process.stdout.write(JSON.stringify({ tool_name: "Edit", tool_input: { file_path: process.argv[1], old_string: process.argv[2], new_string: process.argv[3] } }))' "$1" "$2" "$3"
}
core='packages/core/src/domain/desk.ts'

echo "── the core ────────────────────────────────────────────────────────────"
probe "a relative import" green "write $core \"import { value } from '../domain.ts';\" | guard"
probe "node:fs, static" red "write $core \"import { readFileSync } from 'node:fs';\" | guard"
probe "fs without the node: prefix" red "write $core \"import { readFileSync } from 'fs';\" | guard"
probe "node:fs, dynamic, double quotes" red "write $core 'export const load = () => import(\"node:fs\");' | guard"
probe "node:child_process, static" red "write $core \"import { spawn } from 'node:child_process';\" | guard"
probe "child_process through require" red "write $core \"const run = require('child_process');\" | guard"
probe "the infrastructure package" red "write $core \"import { x } from '@pixecutive/infrastructure';\" | guard"
probe "a framework package" red "write $core \"import { Injectable } from '@nestjs/common';\" | guard"
probe "zod, the core's one library" green "write $core \"import { z } from 'zod';\" | guard"
probe "a re-export of zod" green "write $core \"export { z } from 'zod';\" | guard"
probe "a package beside zod" red "write $core \"import { z } from 'zod-extra';\" | guard"
probe "a re-export of a package" red "write $core \"export { pick } from 'lodash';\" | guard"
probe "vitest in a spec" green "write packages/core/src/domain/desk.spec.ts \"import { it } from 'vitest';\" | guard"
probe "vitest outside a spec" red "write $core \"import { it } from 'vitest';\" | guard"
probe "an import named only in a comment" green "write $core \"// Do not write: import { x } from 'node:fs';\" | guard"
probe "an edit that adds node:fs" red "edit packages/core/src/domain.ts 'export const value = 1;' \"import 'node:fs'; export const value = 1;\" | guard"
probe "an edit that keeps the core clean" green "edit packages/core/src/domain.ts 'value = 1' 'value = 2' | guard"

echo
echo "── the office UI ───────────────────────────────────────────────────────"
probe "the core" red "write apps/office-ui/src/desk.ts \"import { x } from '@pixecutive/core';\" | guard"
probe "a Node module" red "write apps/office-ui/src/desk.ts \"import { join } from 'node:path';\" | guard"
probe "the protocol" green "write apps/office-ui/src/desk.ts \"import { x } from '@pixecutive/protocol';\" | guard"

echo
echo "── port pairs ──────────────────────────────────────────────────────────"
probe "a token with its port" green "write packages/core/src/port/outgoing/deskRepository.token.ts 'export const DESK = Symbol();' | guard"
probe "a token without a port" red "write packages/core/src/port/outgoing/chairRepository.token.ts 'export const CHAIR = Symbol();' | guard"
probe "an adapter with its port" green \
	"write packages/infrastructure/src/adapter/Desk/deskRepository-typeorm.adapter.ts \"import { readFileSync } from 'node:fs';\" | guard"
probe "an adapter without a port" red \
	"write packages/infrastructure/src/adapter/Desk/chairRepository-typeorm.adapter.ts 'export class A {}' | guard"
probe "an adapter without its technology" red \
	"write packages/infrastructure/src/adapter/Desk/deskRepository.adapter.ts 'export class A {}' | guard"
probe "a port that exports its interface" green \
	"write packages/core/src/port/outgoing/chairRepository.interface.ts 'export interface IChairRepository { count(): number; }' | guard"
probe "a port under another name" red \
	"write packages/core/src/port/outgoing/chairRepository.interface.ts 'export interface ChairRepo { count(): number; }' | guard"

echo
echo "── other forms (review run 1) ──────────────────────────────────────────"
probe "node:fs in a core .tsx file" red "write packages/core/src/domain/view.tsx \"import { readFileSync } from 'node:fs';\" | guard"
probe "a relative path from the core into the infrastructure" red \
	"write $core \"import { x } from '../../../infrastructure/src/index.ts';\" | guard"
probe "a relative path from the core into an app" red \
	"write $core \"import { x } from '../../../../apps/company-server/src/index.ts';\" | guard"
probe "a relative path from the office UI into the core" red \
	"write apps/office-ui/src/desk.ts \"import { x } from '../../../packages/core/src/index.ts';\" | guard"
probe "a relative path inside the core" green "write packages/core/src/application/service/s.ts \"import { value } from '../../domain.ts';\" | guard"
probe "a string that reads like an import" green "write $core \"export const hint = 'go from \\\"lobby\\\" to the desk';\" | guard"

probe "a second import on the same line" red "write $core \"import { value } from '../domain.ts'; import { readFileSync } from 'node:fs';\" | guard"

echo
echo "── outside its scope ───────────────────────────────────────────────────"
probe "a package's own config beside src" green "write packages/core/vitest.config.ts \"import { defineConfig } from 'vitest/config';\" | guard"
probe "tooling may use node:fs" green "write scripts/check-x.ts \"import { readFileSync } from 'node:fs';\" | guard"
probe "the company server may use node:fs" green "write apps/company-server/src/main.ts \"import { readFileSync } from 'node:fs';\" | guard"
probe "input that is no JSON" green "printf 'nonsense' | guard"
probe "a broken library is rejected, not passed" red "rm scripts/lib/architecture/judge-architecture.ts; write $core 'export const a = 1;' | guard"

echo
probe_done
