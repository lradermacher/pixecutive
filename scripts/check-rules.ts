// check-rules.ts — the gates of ADR 0001 on .claude/rules/: structure, mechanism, duplicate, budget, globs.
// Usage: node scripts/check-rules.ts [structure | mechanism | duplicate | budget | globs | --all]; exit 2 on an
// unknown gate name, so a typo never runs green.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './lib/frontmatter.ts';
import { loadRules } from './lib/rules/load-rules.ts';
import { isAnchored } from './lib/rules/path-pattern.ts';
import { limitTokens, ruleBudget, tokens } from './lib/rules/rule-budget.ts';
import { statements, type Statement } from './lib/rules/statements.ts';

const maxSummaryWords = 60;
const patternCharacters = /^[A-Za-z0-9._\-/*?]+$/;
const mechanism = /`\[[^\]]+\]`/;

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const rules = loadRules(root);
const findings: string[] = [];
const fail = (finding: string): void => {
	findings.push(finding);
	console.log(`⛔ ${finding}`);
};

function structure(): void {
	const before = findings.length;
	if (rules.length === 0) fail('.claude/rules/ holds no rule');
	for (const rule of rules) {
		if (Object.keys(rule.frontmatter).length === 0) {
			fail(`${rule.path}: no frontmatter — start from .claude/templates/rule.md`);
			continue;
		}
		if (rule.adr === '') fail(`${rule.path}: the required field adr: is missing`);
		else if (!existsSync(join(root, rule.adr))) fail(`${rule.path}: adr: ${rule.adr} does not exist`);
		const words = rule.summary.split(/\s+/).filter(Boolean).length;
		if (words === 0) fail(`${rule.path}: the required field summary: is missing`);
		else if (words > maxSummaryWords) fail(`${rule.path}: summary has ${words} words, at most ${maxSummaryWords}`);
		if (rule.body.trim() === '') fail(`${rule.path}: no content below the frontmatter`);
		if (rule.rawPatterns.length > 0 && rule.patterns.length === 0) {
			fail(`${rule.path}: paths: is so wide that the CLI ignores it, so the rule would silently always load`);
		}
		for (const pattern of rule.patterns) {
			if (pattern.startsWith('!')) fail(`${rule.path}: pattern ${pattern} — negation is not rebuilt by the rule loader`);
			else if (!patternCharacters.test(pattern)) fail(`${rule.path}: pattern ${pattern} uses characters the rule loader does not rebuild`);
			else if (!isAnchored(pattern)) {
				fail(`${rule.path}: pattern ${pattern} is not anchored and matches at every level — write ${pattern}/* instead of ${pattern}/**`);
			}
		}
	}
	if (findings.length === before) console.log(`✅ structure: ${rules.length} rules with adr, summary, content and anchored patterns`);
}

function mechanismGate(): void {
	const before = findings.length;
	let count = 0;
	for (const rule of rules) {
		const sections = rule.body.split(/^(?=## )/m).filter((section) => section.startsWith('## '));
		for (const section of sections) {
			count += 1;
			if (!mechanism.test(section)) {
				const heading = section.split('\n')[0] ?? '';
				fail(`${rule.path}: "${heading.slice(3)}" names no mechanism — add \`[Hook …]\`, \`[Gate …]\` or \`[Prose: why none]\``);
			}
		}
	}
	if (findings.length === before) console.log(`✅ mechanism: ${count} rules, each names its mechanism`);
}

function duplicate(): void {
	const before = findings.length;
	const carriers: Statement[] = [];
	const claude = join(root, 'CLAUDE.md');
	if (existsSync(claude)) carriers.push(...statements('CLAUDE.md', parseFrontmatter(readFileSync(claude, 'utf8')).body));
	for (const rule of rules) carriers.push(...statements(rule.path, rule.body));
	const seen = new Map<string, Statement>();
	const triggers = new Map<string, Statement>();
	for (const statement of carriers) {
		const twin = seen.get(statement.normalized);
		if (twin && twin.carrier !== statement.carrier) {
			fail(`the same rule stands in ${twin.carrier} and ${statement.carrier}: ${statement.wording.slice(0, 100)}`);
		}
		if (!twin) seen.set(statement.normalized, statement);
		if (statement.trigger === null) continue;
		const other = triggers.get(statement.trigger);
		if (other && other.carrier !== statement.carrier) {
			fail(`${other.carrier} and ${statement.carrier} both rule on "${statement.trigger}" — one rule belongs in one carrier`);
		}
		if (!other) triggers.set(statement.trigger, statement);
	}
	if (findings.length === before) console.log(`✅ duplicate: ${rules.length + 1} carriers, no rule stands twice`);
}

function budget(): void {
	const { baselineChars, combinations, worstTokens } = ruleBudget(root);
	for (const combination of combinations) {
		if (combination.tokens > limitTokens) {
			fail(`${combination.names.join(' + ')}: ${combination.tokens} tokens loaded at once, at most ${limitTokens} — a fault in the cut`);
		}
	}
	if (worstTokens <= limitTokens) {
		const share = ((worstTokens / limitTokens) * 100).toFixed(0);
		console.log(`✅ budget: worst case ${worstTokens}/${limitTokens} tokens (${share} % of the limit, baseline ${tokens(baselineChars)})`);
	}
}

// The path sets stand only in the rule files; a pattern copied into the rule tooling is a second list that drifts.
function globs(): void {
	const before = findings.length;
	const patterns = [...new Set(rules.flatMap((rule) => [...rule.rawPatterns, ...rule.patterns.filter((pattern) => pattern.includes('/'))]))];
	const readers = [
		'scripts/check-rules.ts',
		'scripts/rules-for.ts',
		'.claude/hooks/rule-context.ts',
		...readdirSync(join(root, 'scripts/lib/rules')).map((name) => `scripts/lib/rules/${name}`),
	];
	for (const reader of readers.filter((path) => existsSync(join(root, path)))) {
		const text = readFileSync(join(root, reader), 'utf8');
		for (const pattern of patterns.filter((entry) => entry.length >= 5)) {
			const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			if (new RegExp(`(?<![\\w/.-])${escaped}(?![\\w/-])`).test(text)) {
				fail(`${reader} carries the pattern ${pattern} — a second path list next to the rule files`);
			}
		}
	}
	if (findings.length === before) console.log(`✅ globs: ${patterns.length} patterns, none stands outside .claude/rules/`);
}

const gates: Record<string, () => void> = { structure, mechanism: mechanismGate, duplicate, budget, globs };
const wanted = process.argv[2] ?? '--all';
if (wanted === '--all') {
	for (const gate of Object.values(gates)) gate();
} else if (gates[wanted]) {
	gates[wanted]();
} else {
	console.error(`check-rules: unknown gate '${wanted}'; allowed: ${Object.keys(gates).join(', ')} or --all`);
	process.exit(2);
}
if (findings.length > 0) {
	console.log(`\n⛔ check-rules: ${findings.length} finding(s)`);
	process.exit(1);
}
