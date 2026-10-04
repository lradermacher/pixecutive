// agent-guard.ts — rejects an agent start with a family other than its row in model-routing.md, or any haiku. The
// harness limit CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS in settings.json holds the number of agents (ADR 0017).

/**
 * The contract the harness relies on. Every field is required; the probe named here must turn this hook red.
 */
export const contract = {
	rule: 'docs/ADR/0009-models-and-agents.md',
	event: 'PreToolUse',
	matcher: 'Agent',
	stdin: 'tool_name, tool_input.subagent_type, tool_input.model',
	exit: '0 = pass · 2 = rejected, the reason on stderr · anything else = an error in the hook itself',
	probe: 'scripts/probe-hooks.sh',
} as const;

const messages: Record<string, string> = {
	haiku: 'Haiku is never started (ADR 0009). Read the docs yourself or use the research agent.',
	unknown: 'has no row in .claude/data/model-routing.md; add the row (task, family, agent, why) before starting it.',
	ambiguous: 'stands with two families in the table; one task, one family.',
	mismatch: 'is called with another family than its row; overriding the table needs the maintainer.',
	drift: 'has a definition that names another family than the table; align one of them.',
};

try {
	const { readHookInput } = await import('../../scripts/lib/hooks/read-hook-input.ts');
	const { judgeAgent } = await import('../../scripts/lib/agents/agent-verdict.ts');
	const input = readHookInput();
	if (!input || input.toolName !== contract.matcher) process.exit(0);
	const root = process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
	const { verdict, detail } = judgeAgent(root, input.subagentType, input.model);
	if (verdict !== 'pass') {
		process.stderr.write(`⛔ ${detail}: ${messages[verdict] ?? verdict}\n`);
		process.exit(2);
	}
} catch (error) {
	process.stderr.write(`⛔ agent-guard could not judge (${String(error)}); a guard that passes on its own failure is none.\n`);
	process.exit(2);
}
