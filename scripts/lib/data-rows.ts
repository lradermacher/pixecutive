// data-rows.ts — reads the rows of a data file under .claude/data/, past its frontmatter and comments.

import { readFileSync } from 'node:fs';

/**
 * Returns `{ line, cells }` per data row of the tab-separated file at `path`. Skipped are the frontmatter, HTML
 * comments, blank lines, lines starting with `#`, and the first row when its first cell is `header`. Whether a row
 * has enough cells is the caller's finding.
 */
export function dataRows(path: string, header?: string): Array<{ line: number; cells: string[] }> {
	const lines = readFileSync(path, 'utf8').split('\n');
	let start = 0;
	if (lines[0]?.trim() === '---') start = lines.findIndex((line, index) => index > 0 && line.trim() === '---') + 1;
	const rows: Array<{ line: number; cells: string[] }> = [];
	let inComment = false;
	let headerSeen = header === undefined;
	lines.slice(start).forEach((line, offset) => {
		if (inComment || line.trimStart().startsWith('<!--')) {
			inComment = !line.includes('-->');
			return;
		}
		if (line.trim() === '' || line.startsWith('#')) return;
		const cells = line.split('\t').map((cell) => cell.trim());
		if (!headerSeen) {
			headerSeen = true;
			if (cells[0] === header) return;
		}
		rows.push({ line: start + offset + 1, cells });
	});
	return rows;
}
