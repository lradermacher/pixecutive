// check-tests.ts — rejects a changed unit of product code whose spec did not change with it (core rule: a change
// carries its tests). Usage: node scripts/check-tests.ts [--staged | --all | <path>…]; exit 1 on a finding.
// --staged takes the commit's files, --all the branch's changes against main, paths are taken as the change itself.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const unit = /^(packages|apps)\/[^/]+\/src\/.+\.(ts|tsx|mts|cts)$/;
const specOf = (path: string): string => path.replace(/\.(ts|tsx|mts|cts)$/, '.spec.$1');
// A spec, a port's interface, its token and a declaration file run no code of their own.
const exempt = /\.(spec|interface|token|d)\.(ts|tsx|mts|cts)$/;
// Logic is what a test can check: a function, a class, a branch or a loop. Types, constants, enums and re-exports
// have none, and a spec written only to satisfy the gate would test nothing.
const logic = /\bfunction\b|\bclass\b|=>|\bnew\s|\b(if|for|while|switch)\s*\(|\breturn\b/;
const hasLogic = (path: string): boolean => {
	if (!existsSync(path)) return true;
	const code = readFileSync(path, 'utf8')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\/\/.*$/gm, '');
	return logic.test(code);
};

const git = (args: readonly string[]): string[] => {
	try {
		return execFileSync('git', ['-c', 'core.quotePath=false', ...args], { encoding: 'utf8' })
			.split('\n')
			.filter(Boolean);
	} catch {
		return [];
	}
};

function changedFiles(args: readonly string[]): string[] {
	if (args.includes('--staged')) return git(['diff', '--cached', '--name-only', '--no-renames', '--diff-filter=ACM']);
	if (args.length === 0 || args.includes('--all')) {
		// Against the main the branch grew from; on main itself the merge base is HEAD and nothing counts as changed.
		const main = ['origin/main', 'main'].find((ref) => git(['rev-parse', '--verify', '-q', ref]).length > 0);
		if (main === undefined) {
			console.log('⛔ check-tests: no main or origin/main to compare against; fetch it first');
			process.exit(1);
		}
		const base = git(['merge-base', 'HEAD', main])[0] ?? '';
		return base === '' ? [] : git(['diff', '--name-only', '--no-renames', '--diff-filter=ACM', base]);
	}
	return [...args];
}

const changed = new Set(changedFiles(process.argv.slice(2)));
const units = [...changed].filter((path) => unit.test(path) && !exempt.test(path) && hasLogic(path));
const missing = units.filter((path) => !changed.has(specOf(path)));

for (const path of missing) {
	console.log(`⛔ ${path} changed without its test ${specOf(path)} in the same change`);
}
if (missing.length > 0) {
	console.log('   Change the spec beside the unit with it: the type check is no test (core rule).');
	process.exit(1);
}
console.log(`✅ check-tests: ${units.length} changed units with logic, each with its changed spec`);
