// require-ticket.ts — rejects a write to a protected path while no work package is open for this session.

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

/**
 * The contract the harness relies on. Every field is required; the probe named here must turn this hook red.
 */
export const contract = {
	rule: 'docs/ADR/0003-no-write-without-ticket.md',
	event: 'PreToolUse',
	matcher: 'Edit|Write|NotebookEdit',
	stdin: 'tool_name, tool_input.file_path or tool_input.notebook_path, session_id',
	exit: '0 = pass · 2 = protected path without a work package · anything else = an error in the hook itself',
	probe: 'scripts/probe-hooks.sh',
} as const;

// Exit 2 is the only way a hook stops a write in every permission mode; ticket.ts decides, this hook only asks.
try {
	const { readHookInput } = await import('../../scripts/lib/hooks/read-hook-input.ts');
	const input = readHookInput();
	if (!input || !contract.matcher.split('|').includes(input.toolName) || input.filePath === '') process.exit(0);
	const root = process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
	const run = spawnSync('node', [join(root, 'scripts/ticket.ts'), 'check', '--session', input.sessionId, '--path', input.filePath], {
		cwd: root,
		encoding: 'utf8',
		env: { ...process.env, CLAUDE_PROJECT_DIR: root },
	});
	if (run.status !== 0) {
		process.stderr.write(run.stdout || run.stderr || '⛔ ticket.ts check failed without a reason.\n');
		process.exit(2);
	}
	if (run.stdout.startsWith('unblocked:')) process.stderr.write(run.stdout);
} catch (error) {
	process.stderr.write(`⛔ require-ticket could not judge (${String(error)}); a guard that passes on its own failure is none.\n`);
	process.exit(2);
}
