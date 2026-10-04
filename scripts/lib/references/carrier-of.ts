// carrier-of.ts — which kind of carrier a repo path is, so a reference says whether a rule, a hook or a doc names it.

const scriptPrefixes = ['.claude/hooks/', 'scripts/', '.githooks/'];
const carrierPrefixes: ReadonlyArray<[string, string]> = [
	['.claude/rules/', 'RULE'],
	['.claude/skills/', 'SKILL'],
	['.claude/agents/', 'AGENT'],
	['.claude/data/', 'DATA'],
	['.claude/templates/', 'TEMPLATE'],
	['test/', 'TEST'],
	['docs/', 'DOC'],
	['.github/', 'CI'],
];

/**
 * Returns the carrier label of `path`, relative to the repo root or starting with `~` for the user's settings:
 * EVENT for a settings file that wires hooks, RULE, SKILL, AGENT, DATA, TEMPLATE, SCRIPT, TEST, DOC, CI, or OTHER.
 */
export function carrierOf(path: string): string {
	const name = path.split('/').pop() ?? '';
	if (/^settings[\w.-]*\.json$/.test(name) && (path.startsWith('.claude/') || path.startsWith('~'))) return 'EVENT';
	if (name === 'CLAUDE.md') return 'RULE';
	if (path === 'package.json' || scriptPrefixes.some((prefix) => path.startsWith(prefix))) {
		return path.endsWith('.md') ? 'DOC' : 'SCRIPT';
	}
	return carrierPrefixes.find(([prefix]) => path.startsWith(prefix))?.[1] ?? 'OTHER';
}
