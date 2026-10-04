// agent-done.ts — counts down what agent-guard counts up, so two finished agents do not block the session.

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

/**
 * The contract the harness relies on. Every field is required; the probe named here must turn this hook red.
 */
export const contract = {
	rule: 'docs/ADR/0009-models-and-agents.md',
	event: 'SubagentStop',
	matcher: '*',
	stdin: 'session_id',
	exit: '0 always; if it fails, the counter entry expires after 90 minutes',
	probe: 'scripts/probe-hooks.sh',
} as const;

const { readHookInput } = await import('../../scripts/lib/hooks/read-hook-input.ts');
const session = readHookInput()?.sessionId ?? '';
const root = process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
if (session !== '') spawnSync('node', [join(root, 'scripts/ticket.ts'), 'agent-stop', session], { cwd: root, stdio: 'ignore', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
