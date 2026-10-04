// check-tests.ts — rejects a changed unit of product code whose spec did not change with it (core rule: a change
// carries its tests). Usage: node scripts/check-tests.ts [--staged | --all | <path>…]; exit 1 on a finding.
// --staged takes the commit's files, --all the branch's changes against main, paths are taken as the change itself.

import { execFileSync } from 'node:child_process';

const unit = /^(packages|apps)\/[^/]+\/src\/.+\.ts$/;
// A port's interface, its token and a declaration file run no code, so they have nothing to test.
const codeless = /\.(spec|interface|token|d)\.ts$/;

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
		if (main === undefined) return [];
		const base = git(['merge-base', 'HEAD', main])[0] ?? '';
		return base === '' ? [] : git(['diff', '--name-only', '--no-renames', '--diff-filter=ACM', base]);
	}
	return [...args];
}

const changed = new Set(changedFiles(process.argv.slice(2)));
const units = [...changed].filter((path) => unit.test(path) && !codeless.test(path));
const missing = units.filter((path) => !changed.has(path.replace(/\.ts$/, '.spec.ts')));

for (const path of missing) {
	console.log(`⛔ ${path} changed without its test ${path.replace(/\.ts$/, '.spec.ts')} in the same change`);
}
if (missing.length > 0) {
	console.log('   Change the spec beside the unit with it: the type check is no test (core rule).');
	process.exit(1);
}
console.log(`✅ check-tests: ${units.length} changed units, each with its changed spec`);
