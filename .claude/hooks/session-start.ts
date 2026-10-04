// session-start.ts — tells the session what it works on and what is broken: work package, CLI version, git hooks.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

/**
 * The contract the harness relies on. Every field is required; the probe named here must turn this hook red.
 */
export const contract = {
	rule: 'docs/ADR/0003-no-write-without-ticket.md',
	event: 'SessionStart',
	matcher: '',
	stdin: 'session_id',
	exit: '0 always: what it prints lands in the context',
	probe: 'scripts/probe-hooks.sh',
} as const;

const { readHookInput } = await import('../../scripts/lib/hooks/read-hook-input.ts');
const { ruleContextMarker } = await import('../../scripts/lib/rules/rule-context-marker.ts');
const root = process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
const session = readHookInput()?.sessionId ?? '';
const ticket = (...args: string[]): { status: number | null; stdout: string } =>
	spawnSync('node', [join(root, 'scripts/ticket.ts'), ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });

// Every source of SessionStart resets the marker, compact and clear included, so area rules return after compaction.
if (session !== '') rmSync(ruleContextMarker(session), { force: true });
ticket('sweep');
const status = ticket('show', session).stdout.trim();
if (status.startsWith('no work package')) {
	console.log('[package] No work package set: protected paths are not written.');
	console.log('          /code PIX-N reads the card and sets it: node scripts/ticket.ts open PIX-N --type <type> --title "<title>" --acceptance <N>');
} else if (status !== '') {
	console.log(`[package] ${status}`);
}

// A dropped harness capability fails silently: no error, just a gate that never turns red again.
const minimum = existsSync(join(root, '.claude/MIN_CLI')) ? readFileSync(join(root, '.claude/MIN_CLI'), 'utf8').split('\n')[0]?.trim() : '';
const binary = process.env['CLAUDE_CODE_EXECPATH'];
if (minimum && binary) {
	const have = /\d+\.\d+\.\d+/.exec(spawnSync(binary, ['--version'], { encoding: 'utf8' }).stdout ?? '')?.[0] ?? '';
	const older = (a: string, b: string): boolean => a.localeCompare(b, undefined, { numeric: true }) < 0;
	if (have !== '' && older(have, minimum)) console.log(`[cli] ⛔ Claude Code ${have} is older than ${minimum}; hooks can fail silently. See .claude/MIN_CLI.md.`);
}

// core.hooksPath is absolute; after moving the repo git runs without any hook and says nothing.
let hooksPath = '';
try {
	hooksPath = execFileSync('git', ['-C', root, 'config', '--get', 'core.hooksPath'], { encoding: 'utf8' }).trim();
} catch {
	hooksPath = '';
}
const resolved = hooksPath === '' || isAbsolute(hooksPath) ? hooksPath : join(root, hooksPath);
if (resolved === '' || !existsSync(join(resolved, 'pre-commit'))) {
	console.log('[git] ⛔ The history guard is not installed: git runs without the main lock and the leak scan.');
	console.log('      Repair: bash scripts/install-git-hooks.sh');
}
