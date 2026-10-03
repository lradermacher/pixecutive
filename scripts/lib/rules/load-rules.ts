// load-rules.ts — reads every rule under .claude/rules/ with what decides when it loads and what it costs.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseFrontmatter, type FrontmatterValue } from '../frontmatter.ts';
import { normalizePatterns } from './path-pattern.ts';

/** One rule file; without `patterns` it is always loaded and always paid for. */
export interface Rule {
	name: string;
	path: string;
	patterns: string[];
	rawPatterns: string[];
	adr: string;
	summary: string;
	chars: number;
	frontmatter: Record<string, FrontmatterValue>;
	body: string;
}

function markdownFiles(dir: string): string[] {
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return [];
	}
	return entries.flatMap((entry) => {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) return markdownFiles(full);
		return entry.name.endsWith('.md') ? [full] : [];
	});
}

/** Loads every `*.md` below `.claude/rules/` of `root`, recursively as the CLI does; always-loaded rules come first. */
export function loadRules(root: string): Rule[] {
	const rules = markdownFiles(join(root, '.claude', 'rules')).map((full): Rule => {
		const text = readFileSync(full, 'utf8');
		const { data, body } = parseFrontmatter(text);
		const raw = data['paths'];
		return {
			name: full.slice(full.lastIndexOf('/') + 1, -3),
			path: relative(root, full),
			patterns: normalizePatterns(raw),
			rawPatterns: (typeof raw === 'string' ? [raw] : Array.isArray(raw) ? raw : []).filter((entry) => entry !== ''),
			adr: typeof data['adr'] === 'string' ? data['adr'] : '',
			summary: typeof data['summary'] === 'string' ? data['summary'].trim() : '',
			chars: text.length,
			frontmatter: data,
			body,
		};
	});
	const always = (rule: Rule): number => (rule.patterns.length === 0 ? 0 : 1);
	return rules.sort((a, b) => always(a) - always(b) || a.name.localeCompare(b.name));
}
