// architecture-guard.ts — rejects a write that would break the hexagon: an outside import in the core or the office
// UI, or a port file without its partner (ADR 0006 point 9).

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';

/**
 * The contract the harness relies on. Every field is required; the probe named here must turn this hook red.
 */
export const contract = {
	rule: 'docs/ADR/0006-typing-and-import-zones.md',
	event: 'PreToolUse',
	matcher: 'Edit|Write|MultiEdit',
	stdin:
		'tool_name, tool_input.file_path, tool_input.content, tool_input.old_string, tool_input.new_string, tool_input.replace_all, tool_input.edits',
	exit: '0 = pass, or not a product file · 2 = the write would break the hexagon, or the hook could not judge · anything else = an error in the hook itself',
	probe: 'scripts/probe-architecture.sh',
} as const;

try {
	const { readHookInput } = await import('../../scripts/lib/hooks/read-hook-input.ts');
	const { judgeArchitecture } = await import('../../scripts/lib/architecture/judge-architecture.ts');
	const input = readHookInput();
	if (input === null || !contract.matcher.split('|').includes(input.toolName) || input.filePath === '') process.exit(0);
	const root = process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
	const path = relative(root, isAbsolute(input.filePath) ? input.filePath : join(root, input.filePath));
	if (!/^(packages|apps)\/.+\.(ts|tsx|mts|cts)$/.test(path)) process.exit(0);

	// The text the file will hold: a Write gives it whole, an edit is applied to what is there now.
	let text =
		input.toolName === 'Write'
			? input.content
			: existsSync(join(root, path))
				? readFileSync(join(root, path), 'utf8')
				: '';
	if (input.toolName !== 'Write') {
		for (const edit of input.edits) {
			text = edit.replaceAll
				? text.split(edit.oldString).join(edit.newString)
				: text.replace(edit.oldString, () => edit.newString);
		}
	}
	const findings = judgeArchitecture(path, text, (other) => existsSync(join(root, other)));
	if (findings.length > 0) {
		process.stderr.write(`⛔ ${path}: ${findings.join('; ')} (ADR 0006 point 9).\n`);
		process.exit(2);
	}
} catch (error) {
	process.stderr.write(
		`⛔ architecture-guard could not judge (${String(error)}); a guard that passes on its own failure is none.\n`,
	);
	process.exit(2);
}
