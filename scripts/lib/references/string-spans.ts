// string-spans.ts — where the string literals of a JavaScript or TypeScript source lie, past comments and regexes.

const wordBeforeRegex = new Set([
	'return',
	'typeof',
	'instanceof',
	'in',
	'of',
	'new',
	'delete',
	'void',
	'case',
	'do',
	'else',
	'yield',
	'await',
	'throw',
]);

function regexMayStart(source: string, at: number): boolean {
	let last = at - 1;
	while (last >= 0 && /\s/.test(source[last] ?? '')) last -= 1;
	if (last < 0) return true;
	const before = source[last] ?? '';
	if (!/[\w$)\]]/.test(before)) return true;
	if (!/[\w$]/.test(before)) return false;
	let start = last;
	while (start > 0 && /[\w$]/.test(source[start - 1] ?? '')) start -= 1;
	return wordBeforeRegex.has(source.slice(start, last + 1)) && source[start - 1] !== '.';
}

function regexEnd(source: string, at: number): number {
	let inClass = false;
	for (let index = at + 1; index < source.length; index += 1) {
		const c = source[index] ?? '';
		if (c === '\n') return -1;
		if (c === '\\') index += 1;
		else if (inClass) inClass = c !== ']';
		else if (c === '[') inClass = true;
		else if (c === '/') return index;
	}
	return -1;
}

/**
 * Returns `[start, end]` offsets of the contents of every string and template literal in `source`, quotes excluded.
 * A template literal counts whole, `${…}` included. Comments are skipped, and a slash opens a regex literal only where
 * no value stands before it, so a quote inside a regex opens no string.
 */
export function stringSpans(source: string): Array<[number, number]> {
	const spans: Array<[number, number]> = [];
	let index = 0;
	while (index < source.length) {
		const c = source[index] ?? '';
		const next = source[index + 1] ?? '';
		if (c === '/' && next === '/') {
			const end = source.indexOf('\n', index);
			index = end === -1 ? source.length : end;
		} else if (c === '/' && next === '*') {
			const end = source.indexOf('*/', index + 2);
			index = end === -1 ? source.length : end + 2;
		} else if (c === "'" || c === '"' || c === '`') {
			let end = index + 1;
			while (end < source.length && source[end] !== c && (c === '`' || source[end] !== '\n')) {
				end += source[end] === '\\' ? 2 : 1;
			}
			spans.push([index + 1, Math.min(end, source.length)]);
			index = end + 1;
		} else if (c === '/' && regexMayStart(source, index) && regexEnd(source, index) !== -1) {
			index = regexEnd(source, index) + 1;
		} else {
			index += 1;
		}
	}
	return spans;
}
