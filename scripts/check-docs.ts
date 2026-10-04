// check-docs.ts — the checks the ADR README and ADR 0001 decide for documents: ADR frontmatter, a Rejected section,
// a Mechanics section in every workflow ADR, a mechanism on every decision point, and one class per document under
// docs/. Usage: node scripts/check-docs.ts [adr | rejected | mechanics | mechanism | classes | --all]; exit 2 on an unknown check.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataRows } from './lib/data-rows.ts';
import { parseFrontmatter } from './lib/frontmatter.ts';

const kinds = new Set(['architecture', 'technology', 'workflow']);
const statuses = new Set(['proposed', 'accepted', 'rejected', 'deprecated', 'superseded']);
const required = ['status', 'date', 'decision-makers', 'kind', 'supersedes', 'superseded-by'];

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const findings: string[] = [];
const fail = (finding: string): void => {
	findings.push(finding);
	console.log(`⛔ ${finding}`);
};
const listed = (prefix: string): string[] =>
	execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '--', prefix], { cwd: root, encoding: 'utf8' })
		.split('\n')
		.filter((path) => path !== '' && existsSync(join(root, path)));
const records = listed('docs/ADR').filter((path) => /^docs\/ADR\/\d{4}-.*\.md$/.test(path));
const read = (path: string): string => readFileSync(join(root, path), 'utf8');
const status = (path: string): string => String(parseFrontmatter(read(path)).data['status'] ?? '');

// A heading's section runs to the next heading of the same or a higher level.
function section(text: string, heading: RegExp): string | null {
	const lines = text.split('\n');
	const start = lines.findIndex((line) => heading.test(line));
	if (start === -1) return null;
	const level = /^#+/.exec(lines[start] ?? '')?.[0].length ?? 2;
	const end = lines.findIndex((line, index) => index > start && new RegExp(`^#{1,${level}} `).test(line));
	return lines.slice(start + 1, end === -1 ? undefined : end).join('\n');
}

function recordFields(): void {
	const before = findings.length;
	for (const path of records) {
		const { data } = parseFrontmatter(read(path));
		for (const field of required) if (!(field in data)) fail(`${path}: the frontmatter field ${field}: is missing`);
		if (!statuses.has(String(data['status']))) fail(`${path}: status '${String(data['status'])}' is none of ${[...statuses].join(' · ')}`);
		if (!kinds.has(String(data['kind']))) fail(`${path}: kind '${String(data['kind'])}' is none of ${[...kinds].join(' · ')}`);
	}
	if (findings.length === before) console.log(`✅ adr: ${records.length} ADRs with the required fields, a valid status and kind`);
}

function rejected(): void {
	const before = findings.length;
	for (const path of records.filter((adr) => status(adr) === 'accepted')) {
		const body = section(read(path), /^## Rejected\s*$/)?.replace(/<!--[\s\S]*?-->/g, '').trim() ?? '';
		if (body === '') fail(`${path}: the Rejected section is missing or empty; an ADR names what did not survive`);
	}
	if (findings.length === before) console.log('✅ rejected: every accepted ADR names what was rejected');
}

function mechanics(): void {
	const before = findings.length;
	const workflow = records.filter((adr) => status(adr) === 'accepted' && parseFrontmatter(read(adr)).data['kind'] === 'workflow');
	for (const path of workflow) {
		// A comment or an empty diagram fence is no mechanics.
		const body = section(read(path), /^## Mechanics\s*$/)?.replace(/<!--[\s\S]*?-->/g, '').replace(/```\w*\s*```/g, '').trim() ?? '';
		if (body === '') fail(`${path}: a workflow ADR needs a Mechanics section (TEMPLATE.md)`);
	}
	if (findings.length === before) console.log(`✅ mechanics: ${workflow.length} workflow ADRs, each with its Mechanics`);
}

function mechanism(): void {
	const before = findings.length;
	let points = 0;
	for (const path of records.filter((adr) => status(adr) === 'accepted')) {
		const decision = section(read(path), /^## Decision\s*$/) ?? '';
		for (const point of decision.split(/^(?=\d+\. \*\*)/m).filter((part) => /^\d+\. \*\*/.test(part))) {
			points += 1;
			const item = point.split(/\n(?=\S)/)[0] ?? point;
			if (!/`\[[^\]]+\]`/.test(item)) fail(`${path}: decision point "${item.slice(0, 60).replace(/\s+/g, ' ')}…" names no mechanism in brackets`);
		}
	}
	if (findings.length === before) console.log(`✅ mechanism: ${points} decision points, each names its mechanism`);
}

function classes(): void {
	const before = findings.length;
	const table = join(root, '.claude', 'data', 'document-classes.tsv');
	if (!existsSync(table)) {
		fail('.claude/data/document-classes.tsv is missing');
		return;
	}
	const rows = dataRows(table, 'prefix').map(({ cells }) => ({ prefix: cells[0] ?? '', name: cells[1] ?? '' }));
	const canonSection = section(read('CLAUDE.md'), /^## Authoritative documents/);
	if (canonSection === null) fail('CLAUDE.md has no section "Authoritative documents", so canon is unknown');
	const canon = [...(canonSection ?? '').matchAll(/\]\(([^)#\s]+)/g)].map((match) => (match[1] ?? '').replace(/\/README\.md$/, '/').replace(/^\.\//, ''));
	const docs = listed('docs').filter((path) => path.endsWith('.md'));
	for (const path of docs) {
		if (canon.some((entry) => path === entry || (entry.endsWith('/') && path.startsWith(entry)))) continue;
		const hits = rows.filter((row) => path.startsWith(row.prefix));
		const longest = Math.max(0, ...hits.map((row) => row.prefix.length));
		const names = new Set(hits.filter((row) => row.prefix.length === longest).map((row) => row.name));
		if (names.size === 0) fail(`${path} falls into no class of .claude/data/document-classes.tsv and is not canon`);
		if (names.size > 1) fail(`${path} falls into ${[...names].join(' and ')} at once`);
	}
	if (findings.length === before) console.log(`✅ classes: ${docs.length} documents under docs/, each canon or in exactly one class`);
}

const checks: Record<string, () => void> = { adr: recordFields, rejected, mechanics, mechanism, classes };
const wanted = process.argv[2] ?? '--all';
if (wanted === '--all') for (const check of Object.values(checks)) check();
else if (checks[wanted]) checks[wanted]();
else {
	console.error(`check-docs: unknown check '${wanted}'; allowed: ${Object.keys(checks).join(', ')} or --all`);
	process.exit(2);
}
if (findings.length > 0) process.exit(1);
