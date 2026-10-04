// rules-for-path.ts — which rules lie in the context while one file is read or written.

import { realpathSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import { loadRules, type Rule } from './load-rules.ts';
import { patternMatches } from './path-pattern.ts';

function relativeToRoot(path: string, root: string): string | null {
	let candidate = path.replace(/\\/g, '/');
	if (isAbsolute(candidate)) {
		try {
			candidate = relative(realpathSync(root), realpathSync(candidate));
		} catch {
			candidate = relative(root, candidate);
		}
	}
	while (candidate.startsWith('./')) candidate = candidate.slice(2);
	return candidate === '' || candidate.startsWith('..') || isAbsolute(candidate) ? null : candidate;
}

/**
 * Returns every always-loaded rule plus every rule whose patterns match `path`, relative to `root`. A path outside the
 * root matches no pattern, as in the CLI. A path may match several areas; all of them load.
 */
export function rulesForPath(path: string, root: string, rules: readonly Rule[] = loadRules(root)): Rule[] {
	const target = relativeToRoot(path, root);
	return rules.filter(
		(rule) => rule.patterns.length === 0 || (target !== null && rule.patterns.some((pattern) => patternMatches(pattern, target))),
	);
}
