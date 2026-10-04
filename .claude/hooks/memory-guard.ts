// memory-guard.ts — runs check-memory after every write into this repo's auto-memory and hands a finding back.
// The memory lies outside the repo, so no pre-commit ever sees a note; this hook is the only stage that does.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

/**
 * The contract the harness relies on. Every field is required; the probe named here must turn this hook red.
 */
export const contract = {
	rule: 'docs/ADR/0001-one-carrier-per-rule.md',
	event: 'PostToolUse',
	matcher: 'Edit|Write',
	stdin: 'tool_name, tool_input.file_path',
	exit: '0 = not a memory file, or the memory is clean · 2 = check-memory is red, or the hook could not judge · '
		+ 'anything else = an error in the hook itself',
	probe: 'scripts/probe-memory.sh',
} as const;

function real(path: string): string {
	return existsSync(path) ? realpathSync(path) : path;
}

// Both sides are resolved, because a tool may write `/tmp/…` where the directory lies under `/private/tmp/…`.
try {
	const { readHookInput } = await import('../../scripts/lib/hooks/read-hook-input.ts');
	const { memoryDir } = await import('../../scripts/lib/memory/memory-dir.ts');
	const input = readHookInput();
	if (input !== null && contract.matcher.split('|').includes(input.toolName) && input.filePath !== '') {
		const root = process.env['CLAUDE_PROJECT_DIR']
			|| execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
		const target = real(resolve(root, input.filePath));
		if (target.startsWith(real(memoryDir(root)) + sep)) {
			const gate = join(root, 'scripts', 'check-memory.ts');
			if (!existsSync(gate)) throw new Error('scripts/check-memory.ts is missing');
			const run = spawnSync(process.execPath, [gate, '--all'], { cwd: root, encoding: 'utf8' });
			if (run.error !== undefined) throw run.error;
			if (run.status !== 0) {
				const found = `${run.stdout}${run.stderr}`.split('\n').filter((line) => line.startsWith('⛔'));
				process.stderr.write(`⛔ memory-guard: check-memory is red after writing ${input.filePath}\n`);
				process.stderr.write(`${found.map((line) => `  ${line}`).join('\n')}\n`);
				process.stderr.write('   Correct the note until node scripts/check-memory.ts is green.\n');
				process.exit(2);
			}
		}
	}
} catch (error) {
	process.stderr.write(`⛔ memory-guard could not judge (${String(error)}); a guard that passes on failure is none.\n`);
	process.exit(2);
}
