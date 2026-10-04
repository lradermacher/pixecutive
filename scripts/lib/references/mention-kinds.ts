// mention-kinds.ts — whether a name in a script stands in code, in a comment, or in prose inside a string.

import { hashCommentLines } from '../comments/hash-comment-lines.ts';
import { slashCommentLines } from '../comments/slash-comment-lines.ts';
import type { CommentLine } from '../comments/comment-line.ts';
import { onlyMentioned } from '../shell/command-lexer.ts';
import { stringSpans } from './string-spans.ts';

const scriptExtensions = /\.(ts|tsx|mts|cts|js|mjs|cjs|jsx)$/;
// The words after which a path in a string is run, not told; a closed list, so what counts as a call is readable here.
const runners = new Set(
	('bash sh zsh node python python3 source . exec timeout nohup env sudo xargs npx tsx run nice command stdbuf time ' +
		'eval then do else ! {').split(' '),
);

function commentStart(line: string, comment: CommentLine | null): number {
	if (comment === null) return Number.POSITIVE_INFINITY;
	if (comment.whole) return 0;
	return line.endsWith(comment.text) ? line.length - comment.text.length : Math.max(line.indexOf(comment.text), 0);
}

// A path at the start of a string or behind a runner, `$(`, a pipe or a separator is a command; any other is prose.
function proseInString(source: string, begin: number, at: number): boolean {
	let token = at;
	while (token > begin && !/[\s"'`(;|&=]/.test(source[token - 1] ?? '')) token -= 1;
	const words = source.slice(begin, token).split(/\s+/).filter(Boolean);
	while (words.length > 0 && /^-|^\d+$|=/.test(words[words.length - 1] ?? '')) words.pop();
	const last = words[words.length - 1];
	if (last === undefined) return false;
	return !/(\$\(|`|;|&&|\|\||\|)$/.test(last) && !runners.has(last.replace(/^[$(`'"{]+/, ''));
}

/**
 * Reads a script once and returns a judge for its lines: given the 0-based line and the column ranges of the hits,
 * it answers ' COMMENT' when every hit stands in a comment, ' TEXT' when every hit is a comment or prose, else ''.
 * JavaScript and TypeScript read prose from string literals, shell from the call-or-mention lexer; other files get ''.
 */
export function mentionKinds(
	path: string,
	source: string,
): (line: number, hits: ReadonlyArray<[number, number]>) => string {
	const lines = source.split('\n');
	const script = scriptExtensions.test(path);
	const shebang = /^#!.*\b(ba|z)?sh\b/.test(lines[0] ?? '');
	const shell = !script && (path.endsWith('.sh') || path.startsWith('.githooks/') || shebang);
	if (!script && !shell) return () => '';
	const comments = script ? slashCommentLines(source) : hashCommentLines(source);
	const spans = script ? stringSpans(source) : [];
	const lineStarts: number[] = [];
	let offset = 0;
	for (const line of lines) {
		lineStarts.push(offset);
		offset += line.length + 1;
	}
	const isProse = (lineStart: number, from: number, to: number): boolean => {
		if (shell) return onlyMentioned(source, from, to);
		const span = spans.find(([start, end]) => start <= from && to <= end);
		return span !== undefined && proseInString(source, Math.max(span[0], lineStart), from);
	};
	return (line, hits) => {
		const text = lines[line] ?? '';
		const lineStart = lineStarts[line] ?? 0;
		const start = commentStart(text, comments[line] ?? null);
		const inComment = hits.map(([from]) => from >= start);
		if (inComment.every(Boolean)) return ' COMMENT';
		const told = hits.every(
			([from, to], index) => inComment[index] === true || isProse(lineStart, lineStart + from, lineStart + to),
		);
		return told ? ' TEXT' : '';
	};
}
