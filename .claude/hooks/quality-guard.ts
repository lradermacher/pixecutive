// quality-guard.ts — reports a just-written file that breaks the English, comment or one-export gate, on the write
// itself instead of at the commit. It runs the gates on that one file; it never rebuilds them.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';

/**
 * The contract the harness relies on. Every field is required; the probe named here must turn this hook red.
 */
export const contract = {
	rule: 'docs/ADR/0005-code-documentation.md',
	event: 'PostToolUse',
	matcher: 'Edit|Write|NotebookEdit',
	stdin: 'tool_name, tool_input.file_path or tool_input.notebook_path',
	exit: '0 = clean · 2 = the findings go back to the model; the write already happened · anything else = an error',
	probe: 'scripts/probe-hooks.sh',
} as const;

try {
	const { readHookInput } = await import('../../scripts/lib/hooks/read-hook-input.ts');
	const input = readHookInput();
	if (!input || !contract.matcher.split('|').includes(input.toolName) || input.filePath === '') process.exit(0);
	const root = process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
	const path = isAbsolute(input.filePath) ? relative(root, input.filePath) : input.filePath;
	if (path.startsWith('..') || isAbsolute(path) || !existsSync(join(root, path))) process.exit(0);
	const gates = ['check-english.ts', 'check-comments.ts', ...(path.endsWith('.ts') ? ['check-one-export.ts'] : [])];
	const findings = gates.flatMap((gate) => {
		const run = spawnSync('node', [join('scripts', gate), path], { cwd: root, encoding: 'utf8' });
		return run.status === 0 ? [] : [`${run.stdout}${run.stderr}`.trim()];
	});
	if (findings.length > 0) {
		process.stderr.write(`${findings.join('\n')}\n`);
		process.exit(2);
	}
} catch (error) {
	process.stderr.write(`⛔ quality-guard could not judge (${String(error)}); a guard that passes on its own failure is none.\n`);
	process.exit(2);
}
