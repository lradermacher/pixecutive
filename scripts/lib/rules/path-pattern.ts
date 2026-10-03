// path-pattern.ts — matches `paths:` as Claude Code does: a gitignore subset where `**` crosses `/`, `*` and `?` do
// not, a pattern with `/` is anchored, and a matched directory takes everything below it. check-rules rejects the rest.

/** @aggregate The four questions about one pattern language belong together. */

function toRegex(pattern: string): RegExp {
	const source = pattern
		.split(/(\*\*|\*|\?)/)
		.map((part) =>
			part === '**' ? '.*' : part === '*' ? '[^/]*' : part === '?' ? '[^/]' : part.replace(/[.+^${}()|[\]\\]/g, '\\$&'),
		)
		.join('');
	return new RegExp(`^${source}$`);
}

/** Normalizes `paths:` as the CLI does: `x/**` becomes `x`, empty entries drop out, and only `**` means always. */
export function normalizePatterns(raw: unknown): string[] {
	const list = typeof raw === 'string' ? [raw] : Array.isArray(raw) ? raw : [];
	const patterns = list
		.map((entry) => String(entry).trim().replace(/^["']|["']$/g, ''))
		.map((entry) => (entry.endsWith('/**') ? entry.slice(0, -3) : entry))
		.filter((entry) => entry !== '');
	return patterns.every((entry) => entry === '**') ? [] : patterns;
}

/** Returns whether `pattern` is anchored at the root: one without `/` matches at every level, also deep in the tree. */
export function isAnchored(pattern: string): boolean {
	return pattern.includes('/');
}

/** Returns whether `pattern` matches the root-relative path `relative` or one of its parent directories. */
export function patternMatches(pattern: string, relative: string): boolean {
	const regex = toRegex(pattern.replace(/^\/+/, ''));
	const segments = relative.split('/');
	if (!isAnchored(pattern)) return segments.some((segment) => regex.test(segment));
	return segments.some((_, index) => regex.test(segments.slice(0, index + 1).join('/')));
}

/**
 * Returns whether one path can match both patterns. When in doubt it answers yes: a budget that counts one area too
 * many makes the cut sharper, one that counts too few is blind.
 */
export function patternsCanMeet(first: string, second: string): boolean {
	if (!isAnchored(first) || !isAnchored(second)) return true;
	const a = first.replace(/^\/+/, '').split('/');
	const b = second.replace(/^\/+/, '').split('/');
	for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
		const x = a[index] ?? '';
		const y = b[index] ?? '';
		if (x === '**' || y === '**' || x === y) {
			if (x === '**' || y === '**') return true;
			continue;
		}
		const wildX = /[*?]/.test(x);
		const wildY = /[*?]/.test(y);
		if (wildX && wildY) continue;
		if (wildX ? !toRegex(x).test(y) : wildY ? !toRegex(y).test(x) : true) return false;
	}
	return true;
}
