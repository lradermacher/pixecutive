// guard-done.ts — rejects moving a card to Done with an open box, missing card lines or a planned mechanism.

/**
 * The contract the harness relies on. Every field is required; the probe named here must turn this hook red.
 */
export const contract = {
	rule: 'docs/ADR/0003-no-write-without-ticket.md',
	event: 'PreToolUse',
	matcher: 'mcp__atlassian__transitionJiraIssue',
	stdin: 'tool_name, tool_input.issueIdOrKey, tool_input.transition.id, session_id',
	exit: '0 = pass · 2 = the transition is rejected or cannot be judged · anything else = an error in the hook itself',
	probe: 'scripts/probe-ticket.sh',
} as const;

try {
	const { readHookInput } = await import('../../scripts/lib/hooks/read-hook-input.ts');
	const { guardTransition } = await import('../../scripts/lib/ticket/guard-transition.ts');
	const root = process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
	const verdict = guardTransition(readHookInput(), 'exit', root, contract.matcher);
	if (verdict.message !== '') process.stderr.write(`${verdict.message}\n`);
	process.exit(verdict.code);
} catch (error) {
	process.stderr.write(`⛔ guard-done could not judge (${String(error)}); a guard that passes on its own failure is none.\n`);
	process.exit(2);
}
