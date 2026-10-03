// check-comments.ts — rejects comments that break the code-documentation rules in the lines a change wrote.
// Usage: node scripts/check-comments.ts [--staged | --all | <path>…]; without arguments, everything changed since HEAD.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { findViolations } from './lib/comments/find-violations.ts';

const args = process.argv.slice(2);
const staged = args.includes('--staged');
const all = args.includes('--all');
const codeFile = /\.(ts|tsx|mts|cts|js|mjs|cjs|jsx|sh)$/;
const serviceAccounts = new Set(['GitHub', 'dependabot', 'github-actions', 'renovate']);
const outOfScope = /(^|\/)(node_modules|dist|generated)\/|^\.claude\/templates\//;

function git(gitArgs: readonly string[]): string {
	try {
		return execFileSync('git', ['-c', 'core.quotePath=false', ...gitArgs], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		});
	} catch {
		return '';
	}
}

function inScope(path: string): boolean {
	return (codeFile.test(path) || path.startsWith('.githooks/')) && !outOfScope.test(path) && existsSync(path);
}

function writtenLines(path: string): Set<number> | null {
	if (all) return null;
	const tracked = git(['ls-files', '--error-unmatch', '--', path]).trim() !== '';
	if (!tracked) return new Set(readFileSync(path, 'utf8').split('\n').map((_, index) => index + 1));
	const diff = git(['diff', '-U0', ...(staged ? ['--cached'] : []), 'HEAD', '--', path]);
	const rows = new Set<number>();
	for (const hunk of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
		const start = Number(hunk[1]);
		const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
		for (let offset = 0; offset < count; offset += 1) rows.add(start + offset);
	}
	return rows;
}

function personNames(): string[] {
	const log = git(['log', '--format=%an%n%cn%n%(trailers:key=Co-Authored-By,valueonly)']);
	const names = new Set(['Claude']);
	for (const entry of log.split('\n')) {
		const name = entry.replace(/<.*>/, '').trim();
		const first = name.split(/\s+/)[0] ?? '';
		if (/^[A-Za-z][A-Za-z-]{2,}$/.test(first) && !serviceAccounts.has(first)) names.add(first);
	}
	return [...names];
}

const paths = staged
	? git(['diff', '--cached', '--name-only', '--no-renames', '--diff-filter=ACM']).split('\n')
	: args.filter((arg) => !arg.startsWith('--')).length > 0
		? args.filter((arg) => !arg.startsWith('--'))
		: [
				...(all ? git(['ls-files']) : git(['diff', '--name-only', '--diff-filter=d', 'HEAD'])).split('\n'),
				...git(['ls-files', '--others', '--exclude-standard']).split('\n'),
			];

const names = personNames();
let errors = 0;
let warnings = 0;
let checked = 0;
for (const path of [...new Set(paths)].filter(inScope)) {
	const only = writtenLines(path);
	if (only !== null && only.size === 0) continue;
	checked += 1;
	for (const finding of findViolations(path, readFileSync(path, 'utf8'), only, names)) {
		console.log(`${finding.severity === 'error' ? '⛔' : '⚠️ '} ${finding.file}:${finding.line} — ${finding.label}: ${finding.message}`);
		console.log(`     ${finding.text.slice(0, 110)}`);
		if (finding.severity === 'error') errors += 1;
		else warnings += 1;
	}
}
if (errors > 0) {
	console.log(`⛔ check-comments: ${errors} violations in ${checked} files (docs/ADR/0005-code-documentation.md)`);
	process.exit(1);
}
console.log(`✅ check-comments: ${checked} files${warnings > 0 ? `, ${warnings} length warnings` : ''}`);
