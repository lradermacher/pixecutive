// scan-text.ts — finds what may never enter the history in lines of text, without repeating the matched text.

import type { LocalConfig } from './read-local-config.ts';
import { secretPatterns } from './secret-patterns.ts';

/** One line to scan: where it is (`path:line` or `commit path`) and its text. */
export interface ScanLine {
	location: string;
	text: string;
}

/**
 * Returns one finding per location and category, at most five per category. A finding names place and category,
 * never the matched text: a guard that echoes a secret into a terminal or log leaks it a second time.
 */
export function scanText(lines: readonly ScanLine[], config: LocalConfig): string[] {
	const categories: Array<{ category: string; pattern: RegExp }> = [
		{ category: 'secret', pattern: secretPatterns.secret },
		{ category: 'plain-text password fallback', pattern: secretPatterns.fallback },
		{ category: 'local path', pattern: secretPatterns.localPath },
		...config.denylist,
	];
	const findings: string[] = [];
	for (const { category, pattern } of categories) {
		const places = lines.filter((line) => pattern.test(line.location) || pattern.test(line.text)).slice(0, 5);
		for (const place of places) findings.push(`${place.location} — ${category}`);
	}
	return findings;
}
