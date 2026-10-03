// hash-comment-lines.ts — finds the comment on each line of a shell file, as the shell reads it.

import type { CommentLine } from './comment-line.ts';

const heredocStart = /<<(-?)\s*\\?(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2/;

/**
 * Returns, per line, the comment text on it or null. A heredoc body and the continuation of a quoted string are text,
 * not comments; `#` after code counts only after whitespace, so `$#` and `${#x}` are not comments; a shebang is not
 * a comment.
 */
export function hashCommentLines(source: string): Array<CommentLine | null> {
	const out: Array<CommentLine | null> = [];
	let quote = '';
	let terminator = '';
	let stripTabs = false;
	source.split('\n').forEach((line, index) => {
		if (terminator !== '') {
			if ((stripTabs ? line.replace(/^\t+/, '') : line) === terminator) terminator = '';
			out.push(null);
			return;
		}
		if (index === 0 && line.startsWith('#!')) {
			out.push(null);
			return;
		}
		let comment: CommentLine | null = null;
		for (let i = 0; i < line.length; i += 1) {
			const c = line[i] ?? '';
			if (quote === '"') {
				if (c === '\\') i += 1;
				else if (c === '"') quote = '';
				continue;
			}
			if (quote === "'") {
				if (c === "'") quote = '';
				continue;
			}
			if (c === '\\') {
				i += 1;
				continue;
			}
			if (c === '"' || c === "'") {
				quote = c;
				continue;
			}
			const before = line[i - 1] ?? '';
			if (c === '#' && (i === 0 || /\s/.test(before))) {
				comment = { text: line.slice(i + 1).replace(/^\s/, ''), whole: line.slice(0, i).trim() === '' };
				break;
			}
		}
		const heredoc = heredocStart.exec(comment === null ? line : line.slice(0, line.length - comment.text.length));
		if (heredoc !== null && quote === '') {
			terminator = heredoc[3] ?? '';
			stripTabs = heredoc[1] === '-';
		}
		out.push(comment);
	});
	return out;
}
