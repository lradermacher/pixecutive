// find-references.ts — every place in the repo that names a file or a name, the evidence before anything is deleted.
// Usage: node scripts/find-references.ts <path or name>… [--self <path>]; exit 0 = each term is named somewhere,
// 1 = at least one is named nowhere, 2 = wrong call. Rows: label · path:line · spelling · the line, tab-separated.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, normalize, relative } from 'node:path';
import { carrierOf } from './lib/references/carrier-of.ts';
import { generatedLines } from './lib/references/generated-lines.ts';
import { globMatches } from './lib/references/glob-matches.ts';
import { mentionKinds } from './lib/references/mention-kinds.ts';

const usage = 'usage: node scripts/find-references.ts <path or name>… [--self <path>]';
// The tool's own files name search terms as examples and probes, never as a reference.
const ownFiles = new Set(['scripts/find-references.ts', 'scripts/probe-find-references.sh']);
const scriptDirs = ['scripts', '.claude/hooks', '.githooks'];
const fileName = /^[\w.-]+\.[A-Za-z0-9]+$/;
const globToken = /[\w./${}"'-]*[*?][\w./*?${}"'-]*/g;
const rootPrefix = /^\$\{?(?:root|ROOT|repo|REPO|here|HERE)\}?\//;

interface Spelling {
	form: string;
	pattern: RegExp;
	marker: string;
}

function stop(message: string): never {
	console.error(message);
	process.exit(2);
}

function git(args: readonly string[], cwd: string): string[] {
	const run = spawnSync('git', ['-c', 'core.quotePath=false', ...args], { cwd, encoding: 'utf8' });
	return (run.stdout ?? '').split('\n').filter(Boolean);
}

// A short form followed by `.ext` names a sibling file, not this one.
function spellings(term: string): Spelling[] {
	const name = term.split('/').pop() ?? term;
	const pattern = (form: string, short: boolean): RegExp => {
		const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		return new RegExp(`(?<![\\w-])${escaped}(?![\\w-])${short ? '(?!\\.[A-Za-z0-9])' : ''}`, 'g');
	};
	if (!fileName.test(name)) return [{ form: term, pattern: pattern(term, false), marker: '-' }];
	const stem = name.replace(/\.[^.]+$/, '');
	return [
		{ form: name, pattern: pattern(name, false), marker: '-' },
		{ form: stem, pattern: pattern(stem, true), marker: 'no-extension' },
	];
}

function rows(path: string, source: string, term: string, forms: Spelling[], generated: boolean[]): string[] {
	const kind = carrierOf(path);
	const judge = kind === 'SCRIPT' || kind === 'TEST' ? mentionKinds(path, source) : null;
	const full = term.split('/').pop() ?? term;
	const found: string[] = [];
	source.split('\n').forEach((line, index) => {
		let marker = '-';
		let hits: Array<[number, number]> = [];
		for (const form of forms) {
			hits = [...line.matchAll(form.pattern)].map((match): [number, number] => [
				match.index,
				match.index + match[0].length,
			]);
			marker = form.marker;
			if (hits.length > 0) break;
		}
		if (hits.length === 0) return;
		let label = kind;
		if (kind === 'EVENT' && !(line.includes(`.claude/hooks/${full}`) && line.includes('"command"'))) label = 'OTHER';
		if (judge !== null) label += judge(index, hits);
		if (generated[index] === true) label += ' GENERATED';
		found.push(`${label}\t${path}:${index + 1}\t${marker}\t${line.trim().replace(/\t/g, ' ').slice(0, 200)}`);
	});
	return found;
}

// `git grep -F` finds only the literal name; a loop over `scripts/probe-*.sh` runs every probe and names none.
function globRows(root: string, term: string, seen: ReadonlySet<string>): string[] {
	const targets = term.includes('/')
		? [term]
		: [...git(['ls-files'], root), ...git(['ls-files', '--others', '--exclude-standard'], root)].filter(
				(path) => path.split('/').pop() === term,
			);
	const dirs = scriptDirs.filter((dir) => existsSync(join(root, dir)));
	if (targets.length === 0 || dirs.length === 0) return [];
	const found: string[] = [];
	const judges = new Map<string, ReturnType<typeof mentionKinds>>();
	for (const row of git(['grep', '-n', '-I', '--untracked', '-E', '[*?]', '--', ...dirs], root)) {
		const [path = '', number = '', ...rest] = row.split(':');
		const line = rest.join(':');
		if (ownFiles.has(path) || carrierOf(path) !== 'SCRIPT' || seen.has(`${path}:${number}`)) continue;
		for (const token of line.matchAll(globToken)) {
			const pattern = token[0].replace(/["']/g, '').replace(rootPrefix, '');
			// A pattern counts only when its file name carries something of its own: `probe-*.sh` does, `*.sh` does not.
			const stem = (pattern.split('/').pop() ?? '').replace(/\.[^.*?]*$/, '');
			if (stem.replace(/[*?[\]]/g, '').length < 2 || !targets.some((target) => globMatches(target, pattern))) continue;
			if (!judges.has(path)) judges.set(path, mentionKinds(path, readFileSync(join(root, path), 'utf8')));
			const comment = judges.get(path)?.(Number(number) - 1, [[token.index, token.index + token[0].length]]) ?? '';
			const shown = line.trim().replace(/\t/g, ' ').slice(0, 200);
			found.push(`SCRIPT GLOB${comment === ' COMMENT' ? comment : ''}\t${path}:${number}\t-\t${shown}`);
			break;
		}
	}
	return found;
}

const args = process.argv.slice(2);
const terms: string[] = [];
let self: string | null = null;
for (let index = 0; index < args.length; index += 1) {
	const arg = args[index] ?? '';
	if (arg === '--self') {
		const value = args[index + 1];
		if (value === undefined || value === '') stop(usage);
		self = value;
		index += 1;
	} else if (arg !== '') {
		terms.push(arg);
	}
}
if (terms.length === 0) stop(usage);
const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
const root = (top.stdout ?? '').trim();
if (top.status !== 0 || root === '') stop('find-references: not a git repository');
// Absolute, relative to the caller, or from the root, in this order; the root only when the caller has no such file.
if (self !== null) {
	const fromCaller = isAbsolute(self) || existsSync(self) || !existsSync(join(root, self));
	self = fromCaller ? relative(realpathSync(root), existsSync(self) ? realpathSync(self) : self) : normalize(self);
}

const isGenerated = generatedLines(root);
const userSettings = join(homedir(), '.claude', 'settings.json');
let missing = 0;
for (const term of terms) {
	const forms = spellings(term);
	const exclude = [':(exclude,glob)**/node_modules/**', ':(exclude)graphify-out'];
	const fixed = forms.flatMap(({ form }) => ['-e', form]);
	const candidates = git(['grep', '-I', '-l', '--untracked', '-F', ...fixed, '--', '.', ...exclude], root);
	const found: string[] = [];
	const seen = new Set<string>();
	for (const path of candidates) {
		if (ownFiles.has(path) || path === self || !statSync(join(root, path)).isFile()) continue;
		const source = readFileSync(join(root, path), 'utf8');
		for (const row of rows(path, source, term, forms, isGenerated(path, source.split('\n')))) {
			found.push(row);
			seen.add(row.split('\t')[1] ?? '');
		}
	}
	found.push(...globRows(root, term, seen));
	if (existsSync(userSettings)) {
		found.push(...rows('~/.claude/settings.json', readFileSync(userSettings, 'utf8'), term, forms, []));
	}
	if (terms.length > 1) console.log(`== ${term}${found.length === 0 ? ': named nowhere' : ''}`);
	for (const row of found) console.log(row);
	if (found.length === 0) missing += 1;
}
process.exit(missing === 0 ? 0 : 1);
