// unblock-window.ts — opens the maintainer's 45-minute escape from the work-package rule on `/unblock <reason>`.

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

/**
 * The contract the harness relies on. Every field is required; the probe named here must turn this hook red.
 */
export const contract = {
	rule: 'docs/ADR/0003-no-write-without-ticket.md',
	event: 'UserPromptSubmit',
	matcher: '',
	stdin: 'prompt, session_id',
	exit: '0 always: it opens a window or says why it did not, and never blocks the prompt',
	probe: 'scripts/probe-hooks.sh',
} as const;

// A hook and not a skill step: if the model could open the window, the rule would rest on its self-control again.
const { readHookInput } = await import('../../scripts/lib/hooks/read-hook-input.ts');
const input = readHookInput();
const match = input?.prompt.split('\n').map((line) => /^\s*\/unblock\b\s*(.*)$/.exec(line)).find((found) => found !== null);
if (input && match) {
	const reason = (match[1] ?? '').trim();
	if (reason === '') {
		console.log('[unblock] /unblock needs a reason; it is reported with every write. Example: /unblock check the build without the line');
	} else {
		const root = process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
		const run = spawnSync('node', [join(root, 'scripts/ticket.ts'), 'unblock', '--session', input.sessionId, '--reason', reason], {
			cwd: root,
			encoding: 'utf8',
			env: { ...process.env, CLAUDE_PROJECT_DIR: root },
		});
		console.log(run.status === 0 ? `[unblock] Writes are free for 45 minutes — reason: ${reason}. What is built still gets its card.` : `[unblock] ⛔ The window could not be opened: ${run.stderr.trim()}`);
	}
}
