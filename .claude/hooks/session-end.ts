// session-end.ts — closes the work package of the ending session; a cleared context does not know its card.

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

/**
 * The contract the harness relies on. Every field is required; the probe named here must turn this hook red.
 */
export const contract = {
	rule: 'docs/ADR/0003-no-write-without-ticket.md',
	event: 'SessionEnd',
	matcher: '',
	stdin: 'session_id',
	exit: '0 always',
	probe: 'scripts/probe-hooks.sh',
} as const;

// SessionEnd, not Stop: Stop fires after every turn and would drop the package after the first answer.
const { readHookInput } = await import('../../scripts/lib/hooks/read-hook-input.ts');
const session = readHookInput()?.sessionId ?? '';
const root = process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
if (session !== '') spawnSync('node', [join(root, 'scripts/ticket.ts'), 'close', session], { cwd: root, stdio: 'ignore', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
