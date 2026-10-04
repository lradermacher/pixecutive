// agent-verdict.ts — judges an agent start against .claude/data/model-routing.md and the agent's own definition.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from '../frontmatter.ts';

/** @aggregate The verdicts and the judgment that returns them are one decision. */

/** The verdicts of an agent start; `pass` is the only one that lets it run. */
export const agentVerdict = Object.freeze({
	pass: 'pass',
	haiku: 'haiku',
	unknown: 'unknown',
	ambiguous: 'ambiguous',
	mismatch: 'mismatch',
	drift: 'drift',
} as const);
export type AgentVerdict = (typeof agentVerdict)[keyof typeof agentVerdict];

const recorded = new Set(['opus', 'fable', 'sonnet', 'haiku']);

function family(value: string): string {
	return value.split('#')[0]?.trim().replace(/^[`"']|[`"']$/g, '').toLowerCase().split('[')[0]?.trim() ?? '';
}

// Haiku in any spelling, also claude-haiku-4-5: an exact comparison would let a versioned ID through.
function forbidden(value: string): boolean {
	return family(value).includes('haiku');
}

/**
 * Judges a start of `agent` with the explicit `model` against the routing table under `root`. Haiku is rejected in
 * every position first; then the agent needs exactly one family in the table, the call must not override it, and
 * the agent's definition file must name the same family. A missing table leaves every agent unknown, never free.
 */
export function judgeAgent(root: string, agent: string, model: string): { verdict: AgentVerdict; detail: string } {
	if (forbidden(model)) return { verdict: agentVerdict.haiku, detail: `${agent || '(no type)'} called with ${model}` };
	if (agent === '') return { verdict: agentVerdict.pass, detail: '' };
	const table = join(root, '.claude', 'data', 'model-routing.md');
	const rows = existsSync(table)
		? readFileSync(table, 'utf8')
				.split('\n')
				.filter((line) => line.startsWith('|'))
				.map((line) => line.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()))
		: [];
	const families = new Set<string>();
	let fixed = false;
	for (const cells of rows) {
		const rowFamily = family(cells[1] ?? '');
		const name = (cells[2] ?? '').replace(/\(Harness[^)]*\)/, '').trim().replace(/`/g, '');
		if (!recorded.has(rowFamily) || name !== agent) continue;
		families.add(rowFamily);
		fixed ||= /\(Harness · fixed\)/.test(cells[2] ?? '');
	}
	if (families.size === 0) return { verdict: agentVerdict.unknown, detail: agent };
	if (families.size > 1) return { verdict: agentVerdict.ambiguous, detail: `${agent}: ${[...families].sort().join(' ')}` };
	const assigned = [...families][0] ?? '';
	if (forbidden(assigned)) return { verdict: agentVerdict.haiku, detail: `${agent} ${fixed ? 'is pinned by the harness' : 'in the table'}` };
	if (model !== '' && family(model) !== assigned) return { verdict: agentVerdict.mismatch, detail: `${agent}: table ${assigned}, call ${model}` };
	const definition = join(root, '.claude', 'agents', `${agent}.md`);
	const defined = existsSync(definition) ? parseFrontmatter(readFileSync(definition, 'utf8')).data['model'] : undefined;
	if (typeof defined === 'string' && defined !== '' && family(defined) !== assigned) {
		return { verdict: agentVerdict.drift, detail: `${agent}: definition ${defined}, table ${assigned}` };
	}
	return { verdict: agentVerdict.pass, detail: '' };
}
