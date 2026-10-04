// protect-env.ts — rejects reading or writing a real .env file through the file tools; *.example stays allowed.

/**
 * The contract the harness relies on. Every field is required; the probe named here must turn this hook red.
 */
export const contract = {
	rule: 'docs/ADR/0010-security-in-agent-operation.md',
	event: 'PreToolUse',
	matcher: 'Edit|Write|NotebookEdit|Read|Grep',
	stdin: 'tool_name, tool_input.file_path or tool_input.notebook_path or tool_input.path',
	exit: '0 = pass · 2 = a real .env file would be read or written · anything else = an error in the hook itself',
	probe: 'scripts/probe-hooks.sh',
} as const;

// A .env never shows up in a diff, so only the tool call can stop it; the shell side is guard-shell.
try {
	const { readHookInput } = await import('../../scripts/lib/hooks/read-hook-input.ts');
	const input = readHookInput();
	const name = input?.filePath.split('/').pop() ?? '';
	const tool = input?.toolName ?? '';
	if (contract.matcher.split('|').includes(tool) && (name === '.env' || name.startsWith('.env.')) && !name.endsWith('.example')) {
		const verb = tool === 'Read' || tool === 'Grep' ? 'read' : 'written';
		process.stderr.write(`⛔ ${input?.filePath} is not ${verb}: credentials are asked for, never read. A new variable goes into .env.example.\n`);
		process.exit(2);
	}
} catch (error) {
	process.stderr.write(`⛔ protect-env could not judge (${String(error)}); a guard that passes on its own failure is none.\n`);
	process.exit(2);
}
