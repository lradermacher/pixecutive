// files-to-check.ts — the paths a gate checks: given paths, the staged state, or every tracked and untracked file.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/**
 * Resolves the paths a gate checks from its command line arguments.
 * `--staged` takes the staged files with content, which in pre-commit's copy are exactly the files of the commit;
 * no argument or `--all` takes every tracked and untracked file that git does not ignore; anything else is a list of
 * paths.
 * Only paths that exist as files are returned.
 * @throws Error when a named path does not exist.
 */
export function filesToCheck(args: readonly string[]): string[] {
	const git = (gitArgs: readonly string[]): string[] =>
		execFileSync('git', ['-c', 'core.quotePath=false', ...gitArgs], { encoding: 'utf8' }).split('\n').filter(Boolean);
	let paths: string[];
	if (args.includes('--staged')) {
		paths = git(['diff', '--cached', '--name-only', '--no-renames', '--diff-filter=ACM']);
	} else if (args.length === 0 || args.includes('--all')) {
		paths = [...new Set([...git(['ls-files']), ...git(['ls-files', '--others', '--exclude-standard'])])];
	} else {
		// A named path that does not exist is a mistake of the caller; skipping it would turn the gate green.
		const missing = args.filter((path) => !existsSync(path));
		if (missing.length > 0) throw new Error(`no such file: ${missing.join(', ')}`);
		paths = [...args];
	}
	return paths.filter((path) => existsSync(path));
}
