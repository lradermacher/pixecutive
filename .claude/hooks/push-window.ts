// push-window.ts — opens the maintainer's push window when a prompt line starts with `push`, e.g. `/push 8h`.

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

/**
 * The contract the harness relies on. Every field is required; the probe named here must turn this hook red.
 */
export const contract = {
	rule: 'docs/ADR/0004-git-flow-and-history-guard.md',
	event: 'UserPromptSubmit',
	matcher: '',
	stdin: 'prompt, session_id',
	exit: '0 always: it opens a window or says why it did not, and never blocks the prompt',
	probe: 'scripts/probe-hooks.sh',
} as const;

// The model cannot type into this prompt, so a window opened here is the maintainer's yes. A line that starts with
// push is an order, one that only mentions it is talk; no language parsing, which would guess.
const { readHookInput } = await import('../../scripts/lib/hooks/read-hook-input.ts');
const input = readHookInput();
const line = input?.prompt.split('\n').find((candidate) => /^\s*\/?push\w*\b/i.test(candidate));
if (input && line !== undefined) {
	const duration = /(\d{1,4})\s*(h|hours?|min|minutes?)\b/i.exec(line);
	const minutes = !duration ? 30 : /^h/i.test(duration[2] ?? '') ? Math.min(Math.max(Number(duration[1]), 1), 24) * 60 : Math.min(Math.max(Number(duration[1]), 1), 1440);
	const root = process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
	const run = spawnSync('node', [join(root, 'scripts/ticket.ts'), 'push-ok', '--session', input.sessionId, '--minutes', String(minutes)], {
		cwd: root,
		encoding: 'utf8',
		env: { ...process.env, CLAUDE_PROJECT_DIR: root },
	});
	console.log(run.status === 0 ? `[push] Window open for ${minutes} minutes. main stays locked.` : `[push] ⛔ The window could not be opened: ${run.stderr.trim()}`);
}
