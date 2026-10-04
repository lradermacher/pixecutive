// gate-before-pr.ts — rejects `gh pr create` without an open work package, without a review record for the head,
// with a red stage 2, or with a probe that cannot fail. Viewing, listing and committing pass untouched.

import { spawnSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The contract the harness relies on. Every field is required; the probe named here must turn this hook red.
 */
export const contract = {
	rule: 'docs/ADR/0008-testing-and-gates.md',
	event: 'PreToolUse',
	matcher: 'Bash',
	stdin: 'tool_name, tool_input.command, session_id',
	exit: '0 = pass or no pull request · 2 = rejected, the reason on stderr · anything else = an error in the hook',
	probe: 'scripts/probe-hooks.sh',
} as const;

function reject(...lines: string[]): never {
	process.stderr.write(`${lines.join('\n')}\n`);
	process.exit(2);
}

try {
	const { readHookInput } = await import('../../scripts/lib/hooks/read-hook-input.ts');
	const { isPrCreate } = await import('../../scripts/lib/shell/is-pr-create.ts');
	const input = readHookInput();
	if (!input || input.toolName !== contract.matcher) process.exit(0);
	const pullRequest = isPrCreate(input.command);
	if (!pullRequest.creates) process.exit(0);
	const root = process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
	const env = { ...process.env, CLAUDE_PROJECT_DIR: root, CLAUDE_CODE_SESSION_ID: input.sessionId || process.env['CLAUDE_CODE_SESSION_ID'] || '' };
	const run = (command: string, args: readonly string[]): { status: number | null; output: string } => {
		const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', env });
		return { status: result.status, output: `${result.stdout}${result.stderr}` };
	};

	// A pull request is what the maintainer accepts; without a card nobody knows against what.
	if (run('node', ['scripts/ticket.ts', 'show']).output.startsWith('no work package')) {
		reject('⛔ No pull request: no work package is set. /code PIX-N sets it.');
	}
	// The record carries the reviewed commit, and the pull request's head is checked, not whatever is checked out.
	const head = pullRequest.head === '' ? [] : ['--at', pullRequest.head];
	if (run('node', ['scripts/ticket.ts', 'review-ok', ...head]).status !== 0) {
		reject(
			'⛔ No pull request: no independent review is recorded for this head.',
			'   node scripts/ticket.ts show names the range; run the adversarial-review agent on it;',
			'   then node scripts/ticket.ts review-done --findings <n> as a command of its own.',
		);
	}
	// The escape skips stage 2 only, never the card or the review, and only on the maintainer's explicit word.
	if (/(^|[\s;&|])PIX_SKIP_GATE=1\s/.test(input.command) || process.env['PIX_SKIP_GATE'] === '1') {
		process.stderr.write('⚠️  Stage 2 skipped (PIX_SKIP_GATE=1).\n');
		process.exit(0);
	}
	const log = join(tmpdir(), 'pixecutive-gate-before-pr.log');
	const stage2 = run('node', ['scripts/verify-full.ts']);
	writeFileSync(log, stage2.output);
	if (stage2.status !== 0) reject('⛔ No pull request: stage 2 is red.', `   Full log: ${log}`);
	// The probe of this gate's own detector runs in pre-commit: here it would stop firing once its subject broke.
	const failed = readdirSync(join(root, 'scripts'))
		.filter((name) => /^probe-.+\.(sh|ts)$/.test(name) && name !== 'probe-pr-gate.ts')
		.filter((name) => run(name.endsWith('.ts') ? 'node' : 'bash', [join('scripts', name)]).status !== 0);
	if (failed.length > 0) {
		reject(`⛔ No pull request: a probe is red — ${failed.join(', ')}. A gate that cannot fail any more is decoration.`);
	}
	process.stderr.write('✅ Stage 2 green and every probe as expected; the pull request may be created.\n');
} catch (error) {
	process.stderr.write(`⛔ gate-before-pr could not judge (${String(error)}); a guard that passes on its own failure is none.\n`);
	process.exit(2);
}
