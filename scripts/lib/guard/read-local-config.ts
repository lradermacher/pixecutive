// read-local-config.ts — reads the operator's denylist and allowed authors from the gitignored local config.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** The history guard's part of `pixecutive.local.json`; `problems` lists every entry that could not be used. */
export interface LocalConfig {
	path: string;
	found: boolean;
	denylist: Array<{ category: string; pattern: RegExp }>;
	authors: string[];
	problems: string[];
}

function plain(value: unknown): value is string {
	return typeof value === 'string' && value.trim() !== '' && !/[\t\n\r]/.test(value);
}

// A linked worktree has no copy of the gitignored config; the main worktree's applies, or its denylist would be off.
function localConfigPath(root: string): string {
	const own = join(root, 'pixecutive.local.json');
	if (existsSync(own)) return own;
	try {
		const common = execFileSync('git', ['-C', root, 'rev-parse', '--path-format=absolute', '--git-common-dir'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		}).trim();
		const main = join(dirname(common), 'pixecutive.local.json');
		return existsSync(main) ? main : own;
	} catch {
		return own;
	}
}

/**
 * Reads the config named by `PIXECUTIVE_LOCAL_CONFIG`, else `pixecutive.local.json` in the repo root or, in a
 * linked worktree, in the main one. A missing file is no problem; a file that cannot be read, or an entry that is
 * malformed, is reported in `problems` and never skipped silently.
 */
export function readLocalConfig(root: string): LocalConfig {
	const path = process.env['PIXECUTIVE_LOCAL_CONFIG'] ?? localConfigPath(root);
	const config: LocalConfig = { path, found: existsSync(path), denylist: [], authors: [], problems: [] };
	if (!config.found) return config;
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(path, 'utf8'));
	} catch (error) {
		config.problems.push(`${path}: not valid JSON (${error instanceof Error ? error.message : String(error)})`);
		return config;
	}
	const guard = (parsed as { historyGuard?: { denylist?: unknown; authors?: unknown } }).historyGuard ?? {};
	const denylist = Array.isArray(guard.denylist) ? guard.denylist : [];
	denylist.forEach((entry: { category?: unknown; pattern?: unknown }, index) => {
		if (!plain(entry?.category) || !plain(entry?.pattern)) {
			config.problems.push(`${path}: historyGuard.denylist[${index}] needs a category and a pattern on one line each`);
			return;
		}
		try {
			config.denylist.push({ category: entry.category, pattern: new RegExp(entry.pattern, 'i') });
		} catch {
			config.problems.push(`${path}: the pattern for '${entry.category}' is not a valid regular expression`);
		}
	});
	const authors = Array.isArray(guard.authors) ? guard.authors : [];
	authors.forEach((mail: unknown, index) => {
		if (!plain(mail) || !mail.includes('@')) config.problems.push(`${path}: historyGuard.authors[${index}] is not a mail address`);
		else config.authors.push(mail.trim().toLowerCase());
	});
	return config;
}
