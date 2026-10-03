// frontmatter.ts — reads the YAML head of a rule, skill, agent or data file without a YAML dependency.

/** A frontmatter value: a scalar, a list of scalars, or one nested level of scalars. */
export type FrontmatterValue = string | string[] | Record<string, string>;

const blockMarkers = new Set(['>', '|', '>-', '|-']);

function scalar(value: string): string {
	return value
		.replace(/\s+#.*$/, '')
		.trim()
		.replace(/^["']|["']$/g, '');
}

/**
 * Splits `text` into its frontmatter and body. Reads the subset the carriers use: `key: value`, folded and literal
 * blocks joined into one line, `- item` lists, `[]` and `{}`, and one nested level. A hand parser, because a hook that
 * needs a package a fresh checkout lacks fails silently.
 */
export function parseFrontmatter(text: string): { data: Record<string, FrontmatterValue>; body: string } {
	const data: Record<string, FrontmatterValue> = {};
	if (!text.startsWith('---')) return { data, body: text };
	const end = text.indexOf('\n---', 3);
	if (end === -1) return { data, body: text };
	const body = text.slice(end + 4).replace(/^[^\n]*\n/, '').replace(/^\n+/, '');
	let key = '';
	let block: string[] | null = null;
	for (const raw of text.slice(3, end).split('\n')) {
		const line = raw.trimEnd();
		if (line.trim() === '' || line.trim().startsWith('#')) continue;
		if (block !== null && /^(\s{2}|\t)/.test(line)) {
			block.push(line.trim());
			continue;
		}
		if (block !== null) {
			data[key] = block.join(' ').trim();
			block = null;
		}
		const current = data[key];
		const item = /^\s*-\s+(.*)$/.exec(line);
		if (item && Array.isArray(current)) {
			current.push(scalar(item[1] ?? ''));
			continue;
		}
		const nested = /^\s+([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
		if (nested && current !== undefined && typeof current !== 'string' && (!Array.isArray(current) || current.length === 0)) {
			const map = Array.isArray(current) ? {} : current;
			map[nested[1] ?? ''] = scalar(nested[2] ?? '');
			data[key] = map;
			continue;
		}
		const pair = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
		if (!pair) continue;
		key = pair[1] ?? '';
		const value = scalar(pair[2] ?? '');
		if (blockMarkers.has(value)) block = [];
		data[key] = value === '' || value === '[]' ? [] : value === '{}' ? {} : value;
	}
	if (block !== null) data[key] = block.join(' ').trim();
	return { data, body };
}
