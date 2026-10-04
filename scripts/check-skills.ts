// check-skills.ts — the structure gate of every skill against .claude/templates/skill.md: fields, steps, acceptance,
// links that resolve, no rule or history inside, a short description, and a complete roster.
// Usage: node scripts/check-skills.ts [structure | reference | boundary | budget | roster | --all]; exit 2 on unknown.

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, normalize, relative } from 'node:path';
import { dataRows } from './lib/data-rows.ts';
import { parseFrontmatter } from './lib/frontmatter.ts';

const maxDescription = 300;
const fields = ['name', 'description', 'rules', 'data', 'gates'];
const topDirs = ['docs/', 'apps/', 'packages/', '.claude/', '.githooks/', 'scripts/'];
const date = /\b\d{4}-\d{2}-\d{2}\b|\b\d{2}\.\d{2}\.\d{4}\b/;

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const skillsDir = join(root, '.claude', 'skills');
const rosterFile = join(root, '.claude', 'data', 'skill-conformance.tsv');
const findings: string[] = [];
const fail = (finding: string): void => {
	findings.push(finding);
	console.log(`⛔ ${finding}`);
};

const own = existsSync(skillsDir)
	? readdirSync(skillsDir).filter((name) => !lstatSync(join(skillsDir, name)).isSymbolicLink() && existsSync(join(skillsDir, name, 'SKILL.md')))
	: [];
const roster = existsSync(rosterFile) ? dataRows(rosterFile, 'skill').map(({ cells }) => cells[0] ?? '').filter(Boolean) : null;
const measured = own.filter((name) => roster?.includes(name));
const skill = (name: string): ReturnType<typeof parseFrontmatter> => parseFrontmatter(readFileSync(join(skillsDir, name, 'SKILL.md'), 'utf8'));
const listOf = (value: unknown): string[] => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []);

function filesIn(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory() ? filesIn(join(dir, entry.name)) : [relative(root, join(dir, entry.name))],
	);
}

function structure(): void {
	const before = findings.length;
	for (const name of measured) {
		const path = `.claude/skills/${name}/SKILL.md`;
		const { data, body } = skill(name);
		for (const field of fields) if (!(field in data)) fail(`${path}: the required field ${field}: is missing`);
		if ('when' in data) fail(`${path}: there is no when: field; the trigger lives in description`);
		if (!/^## Steps\s*$/m.test(body)) fail(`${path}: no ## Steps section; a skill without steps is no skill`);
		else if (!/^\d+\. \*\*/m.test(body)) fail(`${path}: ## Steps carries no numbered step`);
		if (!/^## Acceptance\s*$/m.test(body)) fail(`${path}: no ## Acceptance section`);
		else if (!/^- \[ \]/m.test(body)) fail(`${path}: ## Acceptance carries no box`);
		const declared = listOf(data['data']);
		for (const side of filesIn(join(skillsDir, name)).filter((file) => file !== path)) {
			if (!declared.includes(side)) fail(`${side} lies in the skill but no data: entry names it`);
		}
	}
	if (findings.length === before) console.log(`✅ structure: ${measured.length} skills with fields, steps and acceptance`);
}

function reference(): void {
	const before = findings.length;
	for (const name of measured) {
		const path = `.claude/skills/${name}/SKILL.md`;
		const { data, body } = skill(name);
		for (const field of ['rules', 'data', 'gates']) {
			for (const target of listOf(data[field])) if (!existsSync(join(root, target))) fail(`${path}: ${field}: ${target} does not exist`);
		}
		for (const span of body.match(/`[^`\n]+`/g) ?? []) {
			const text = span.slice(1, -1);
			const placeholder = /[<>*?\s]/.test(text);
			if (!placeholder && text.includes('/') && (topDirs.some((dir) => text.startsWith(dir)) || /\.(md|ts|tsv|txt|json|sh)$/.test(text))) {
				fail(`${path}: ${span} is a path as a code span; a path is a Markdown link or a frontmatter field`);
			}
		}
		for (const match of body.matchAll(/\[([^\]\n]*)\]\(([^)\s]+)\)/g)) {
			const target = match[2] ?? '';
			if (/^(https?:|mailto:|#)/.test(target)) continue;
			if (!existsSync(normalize(join(skillsDir, name, target.split('#')[0] ?? '')))) fail(`${path}: the link [${match[1]}](${target}) leads nowhere`);
		}
	}
	if (findings.length === before) console.log(`✅ reference: every path and link of ${measured.length} skills resolves`);
}

function boundary(): void {
	const before = findings.length;
	for (const name of measured) {
		const path = `.claude/skills/${name}/SKILL.md`;
		const { body } = skill(name);
		body.split('\n').forEach((line, index) => {
			if (date.test(line)) fail(`${path}:${index + 1}: a date in the text; history belongs in the card or an ADR`);
		});
		// A rule line counts per paragraph: Markdown wraps, and the link of a ⛔ often stands two lines further.
		for (const paragraph of body.split(/\n\s*\n/)) {
			if (paragraph.includes('⛔') && !/\]\([^)]+\)/.test(paragraph)) {
				fail(`${path}: a rule line without a link; a skill links rules, it never repeats them`);
			}
		}
	}
	if (findings.length === before) console.log(`✅ boundary: ${measured.length} skills without own rules and without history`);
}

function budget(): void {
	const before = findings.length;
	let total = 0;
	for (const name of own) {
		const description = String(skill(name).data['description'] ?? '').replace(/\s+/g, ' ').trim();
		total += description.length;
		if (description.length > maxDescription) fail(`.claude/skills/${name}/SKILL.md: description has ${description.length} characters, at most ${maxDescription}; it sits in every system prompt`);
	}
	if (findings.length === before) console.log(`✅ budget: ${own.length} descriptions, ${total} characters together`);
}

function rosterCheck(): void {
	const before = findings.length;
	if (roster === null) {
		fail('.claude/data/skill-conformance.tsv is missing; without it no form check measures anything');
		return;
	}
	for (const name of own) if (!roster.includes(name)) fail(`${name} has no row in .claude/data/skill-conformance.tsv`);
	for (const name of new Set(roster)) {
		if (!own.includes(name)) fail(`.claude/data/skill-conformance.tsv: row ${name} names no skill`);
		if (roster.filter((entry) => entry === name).length > 1) fail(`.claude/data/skill-conformance.tsv: ${name} stands more than once`);
	}
	if (findings.length === before) console.log(`✅ roster: ${own.length} skills, each with exactly one row`);
}

const checks: Record<string, () => void> = { structure, reference, boundary, budget, roster: rosterCheck };
const wanted = process.argv[2] ?? '--all';
if (wanted === '--all') for (const check of Object.values(checks)) check();
else if (checks[wanted]) checks[wanted]();
else {
	console.error(`check-skills: unknown check '${wanted}'; allowed: ${Object.keys(checks).join(', ')} or --all`);
	process.exit(2);
}
if (findings.length > 0) process.exit(1);
