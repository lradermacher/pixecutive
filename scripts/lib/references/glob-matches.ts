// glob-matches.ts — whether a path pattern with `*`, `?` or `**/` selects a repo path.

/**
 * Returns true when `pattern` selects `path`. A double star before a slash stands for zero or more directories, `*`
 * and `?` stay inside one directory; a pattern without `/` is held against the file name alone, as a loop's glob is.
 */
export function globMatches(path: string, pattern: string): boolean {
	const subject = pattern.includes('/') ? path : (path.split('/').pop() ?? '');
	const source = pattern
		.split(/(\*\*\/|\*|\?)/)
		.map((part) => {
			if (part === '**/') return '(?:.*/)?';
			if (part === '*') return '[^/]*';
			if (part === '?') return '[^/]';
			return part.replace(/[.+^${}()|[\]\\]/g, '\\$&');
		})
		.join('');
	return new RegExp(`^${source}$`).test(subject);
}
