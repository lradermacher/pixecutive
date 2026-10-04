// check-memory.ts — rejects an auto-memory that repeats a rule, breaks its index or frontmatter, or points nowhere.
// Usage: node scripts/check-memory.ts [budget | frontmatter | index | duplicate | paths | links | --all]; exit 2 on an
// unknown gate name. The memory lies outside the repo, so the memory-guard hook runs this after every write into it.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './lib/frontmatter.ts';
import { memoryDir } from './lib/memory/memory-dir.ts';
import { loadRules } from './lib/rules/load-rules.ts';
import { statements, type Statement } from './lib/rules/statements.ts';

const indexName = 'MEMORY.md';
// The harness stops reading the index after 200 lines; 100 keeps a reserve so no entry is cut off unnoticed.
const maxIndexLines = 100;
const memoryKinds = Object.freeze({
	user: 'user',
	feedback: 'feedback',
	project: 'project',
	reference: 'reference',
} as const);
const indexLine = /^- \[[^\]]+\]\(([^)\s]+\.md)\) — \S/;
const wikiLink = /\[\[([^\]]+)\]\]/g;
const codeSpan = /`[^`]*`/g;

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const dir = memoryDir(root);
const findings: string[] = [];
const fail = (finding: string): void => {
	findings.push(finding);
	console.log(`⛔ ${finding}`);
};

function memories(): string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((name) => name.endsWith('.md') && name !== indexName)
		.sort();
}

function read(name: string): string {
	return readFileSync(join(dir, name), 'utf8');
}

function text(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function budget(): void {
	if (!existsSync(join(dir, indexName))) {
		fail(`${indexName} is missing under ${dir}; the index is what loads in every session`);
		return;
	}
	const lines = read(indexName).replace(/\n$/, '').split('\n').length;
	if (lines > maxIndexLines) fail(`${indexName} has ${lines} lines, at most ${maxIndexLines}`);
	else console.log(`✅ budget: ${indexName} ${lines}/${maxIndexLines} lines`);
}

function frontmatter(): void {
	const files = memories();
	if (files.length === 0) {
		fail(`no memory file under ${dir}; a gate that looks at nothing is not green — is the path derived wrongly?`);
		return;
	}
	const before = findings.length;
	const allowed = Object.values(memoryKinds).join(' · ');
	for (const name of files) {
		const { data } = parseFrontmatter(read(name));
		if (text(data['name']) === '') fail(`${name}: the frontmatter has no name:`);
		if (text(data['description']) === '') fail(`${name}: the frontmatter has no description:`);
		const metadata = data['metadata'];
		const kind = typeof metadata === 'object' && !Array.isArray(metadata) ? text(metadata['type']) : '';
		if (kind === '') fail(`${name}: no metadata.type; allowed are ${allowed}, and a rule is none of them`);
		else if (!Object.hasOwn(memoryKinds, kind)) fail(`${name}: kind '${kind}'; allowed are only ${allowed}`);
	}
	if (findings.length === before) console.log(`✅ frontmatter: ${files.length} files with name, description and kind`);
}

function index(): void {
	if (!existsSync(join(dir, indexName))) {
		fail(`${indexName} is missing under ${dir}`);
		return;
	}
	const before = findings.length;
	const listed = new Set<string>();
	read(indexName)
		.split('\n')
		.forEach((line, offset) => {
			if (line.trim() === '' || line.startsWith('#')) return;
			const entry = indexLine.exec(line);
			if (entry === null) {
				fail(`${indexName}:${offset + 1} is no index line \`- [Title](file.md) — hook\`: ${line.slice(0, 80)}`);
				return;
			}
			const file = entry[1] ?? '';
			if (listed.has(file)) fail(`${indexName}:${offset + 1} lists ${file} a second time`);
			listed.add(file);
			if (!existsSync(join(dir, file))) fail(`${indexName}:${offset + 1} points to ${file}, which does not exist`);
		});
	// The harness writes the file before its index line, so a file without a line is work in progress, not a finding.
	const unlisted = memories().filter((name) => !listed.has(name));
	const note = unlisted.length > 0 ? `, not listed yet: ${unlisted.slice(0, 3).join(', ')}` : '';
	if (findings.length === before) console.log(`✅ index: ${listed.size} lines, each points to an existing file${note}`);
}

function duplicate(): void {
	const before = findings.length;
	const rules = loadRules(root);
	const carriers: Statement[] = [];
	const claude = join(root, 'CLAUDE.md');
	if (existsSync(claude)) carriers.push(...statements('CLAUDE.md', parseFrontmatter(readFileSync(claude, 'utf8')).body));
	for (const rule of rules) carriers.push(...statements(rule.path, rule.body));
	const seen = new Map<string, Statement>();
	const triggers = new Map<string, Statement>();
	for (const statement of carriers) {
		if (!seen.has(statement.normalized)) seen.set(statement.normalized, statement);
		if (statement.trigger !== null && !triggers.has(statement.trigger)) triggers.set(statement.trigger, statement);
	}
	const files = memories();
	for (const name of files) {
		const { data, body } = parseFrontmatter(read(name));
		for (const statement of statements(`memory/${name}`, body, text(data['description']))) {
			const twin = seen.get(statement.normalized);
			const other = statement.trigger === null ? undefined : triggers.get(statement.trigger);
			if (twin !== undefined) {
				fail(`the same rule stands in ${twin.carrier} and ${statement.carrier}: ${statement.wording.slice(0, 100)}`);
			} else if (other !== undefined) {
				fail(`${other.carrier} and ${statement.carrier} both rule on "${statement.trigger}"; the memory entry goes`);
			}
		}
	}
	if (findings.length === before) {
		console.log(`✅ duplicate: ${files.length} memories against ${rules.length + 1} carriers, no rule stands in both`);
	}
}

function git(args: readonly string[]): string[] {
	try {
		return execFileSync('git', ['-C', root, '-c', 'core.quotePath=false', ...args], { encoding: 'utf8' })
			.split('\n')
			.filter(Boolean);
	} catch {
		return [];
	}
}

// Only words that start at a top-level directory of the repo count as paths, so a URL or a foreign repo never does.
function namedPaths(content: string, roots: ReadonlySet<string>): string[] {
	const found = new Set<string>();
	const bare = /(?<![\w/.])([.\w-]+\/[\w./-]+)/g;
	const candidates = [...content.matchAll(/`([^`\s]+)`/g)].map((match) => match[1] ?? '');
	candidates.push(...[...content.replace(codeSpan, ' ').matchAll(bare)].map((match) => match[1] ?? ''));
	for (const raw of candidates) {
		// A line number, an ellipsis and a placeholder are no paths; each would be a false alarm.
		const candidate = raw.replace(/[.,;:)]+$/, '').replace(/:\d+(-\d+)?$/, '');
		if (candidate.includes('...') || candidate.includes('…') || /[<>*{}]/.test(candidate)) continue;
		if (roots.has(candidate.split('/')[0] ?? '') && candidate.includes('/')) found.add(candidate);
	}
	return [...found];
}

function paths(): void {
	const before = findings.length;
	const tracked = [...git(['ls-files']), ...git(['ls-files', '--others', '--exclude-standard'])];
	const roots = new Set(tracked.filter((path) => path.includes('/')).map((path) => path.split('/')[0] ?? ''));
	let onBranches: Set<string> | null = null;
	let checked = 0;
	for (const name of memories()) {
		for (const candidate of namedPaths(read(name), roots)) {
			checked += 1;
			if (existsSync(join(root, candidate))) continue;
			// Work on a feature branch is the normal case; a path that lives on any branch is not dead.
			onBranches ??= new Set(
				git(['for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes']).flatMap((ref) =>
					git(['ls-tree', '-r', '--name-only', ref]),
				),
			);
			const needle = candidate.replace(/\/$/, '');
			if ([...onBranches].some((path) => path === needle || path.startsWith(`${needle}/`))) continue;
			fail(`${name} names \`${candidate}\`, which exists on no branch; the note is read and believed in every session`);
		}
	}
	if (findings.length === before) console.log(`✅ paths: ${checked} repo paths named, each exists on some branch`);
}

function links(): void {
	const before = findings.length;
	const files = memories();
	const names = new Set(files.map((name) => name.slice(0, -3)));
	let checked = 0;
	for (const name of files) {
		for (const match of read(name).replace(codeSpan, ' ').matchAll(wikiLink)) {
			checked += 1;
			const target = match[1] ?? '';
			if (!names.has(target)) fail(`${name} links [[${target}]], which is no note; point it where the statement lives`);
		}
	}
	if (findings.length === before) console.log(`✅ links: ${checked} [[links]], each points to an existing note`);
}

const gates: Record<string, () => void> = { budget, frontmatter, index, duplicate, paths, links };
const wanted = process.argv[2] ?? '--all';
if (wanted !== '--all' && gates[wanted] === undefined) {
	console.error(`check-memory: unknown gate '${wanted}'; allowed: ${Object.keys(gates).join(', ')} or --all`);
	process.exit(2);
}
// A checkout without a session has no memory; only an explicit MEMORY_DIR must exist.
if (!existsSync(dir) && (process.env['MEMORY_DIR'] ?? '') === '') {
	console.log(`✅ check-memory: no auto-memory at ${dir}, nothing to judge on this machine`);
	process.exit(0);
}
for (const [name, gate] of Object.entries(gates)) if (wanted === '--all' || wanted === name) gate();
if (findings.length > 0) {
	console.log(`\n⛔ check-memory: ${findings.length} finding(s); memory holds no rule and points nowhere dead`);
	process.exit(1);
}
