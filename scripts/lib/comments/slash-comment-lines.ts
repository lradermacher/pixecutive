// slash-comment-lines.ts — finds the comment on each line of a file that uses `//` and `/* */` comments.

import type { CommentLine } from './comment-line.ts';

type CommentStart = { kind: 'line' | 'block'; at: number };
type Attempt = { comment: CommentStart | null; swallowedAt: number };
type Reader = {
	line: string;
	skipped: Set<number>;
	literals: number[];
	backticksPaired: boolean;
	deadEnds: Set<number>;
};

const regexMayFollowWord = new Set([
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
const quoteStates = ['', "'", '"', '`'];

function charAt(line: string, index: number): string {
	return line[index] ?? '';
}

function opensRegexLiteral(line: string, at: number): boolean {
	let last = at - 1;
	while (last >= 0 && /\s/.test(charAt(line, last))) last -= 1;
	if (last < 0) return true;
	// `!` before a slash is negation in front of a pattern, unless a value stands before it (`a!/2`).
	if (charAt(line, last) === '!') return !/[A-Za-z0-9_$)\]`'"]/.test(charAt(line, last - 1));
	if (!/[A-Za-z0-9_$]/.test(charAt(line, last))) return true;
	let start = last;
	while (start > 0 && /[A-Za-z0-9_$]/.test(charAt(line, start - 1))) start -= 1;
	while (start <= last && /[0-9]/.test(charAt(line, start))) start += 1;
	if (start > last || !regexMayFollowWord.has(line.slice(start, last + 1))) return false;
	return charAt(line, start - 1) !== '.';
}

function scanRegexLiteral(line: string, at: number): number {
	let inCharacterClass = false;
	for (let i = at + 1; i < line.length; i += 1) {
		const c = charAt(line, i);
		if (c === '\\') {
			i += 1;
			continue;
		}
		if (inCharacterClass) {
			if (c === ']') inCharacterClass = false;
			continue;
		}
		if (c === '[') {
			inCharacterClass = true;
			continue;
		}
		if (c === '/') {
			// A slash followed by a comment start closes nothing: a path in prose must not swallow a block.
			return charAt(line, i + 1) === '/' || charAt(line, i + 1) === '*' ? -1 : i;
		}
	}
	return -1;
}

function scanForComment(reader: Reader, at: number): Attempt {
	const { line, skipped, literals, deadEnds } = reader;
	let quote = '';
	let deadEnd = false;
	const tail: number[] = [];
	for (let i = at; i < line.length; i += 1) {
		const state = i * quoteStates.length + quoteStates.indexOf(quote);
		if (deadEnds.has(state)) {
			deadEnd = true;
			break;
		}
		tail.push(state);
		const c = charAt(line, i);
		if (quote !== '') {
			if (c === '\\') {
				i += 1;
				continue;
			}
			if (c === quote) quote = '';
			continue;
		}
		if (c === "'" || c === '"' || c === '`') {
			quote = c;
			continue;
		}
		if (c === '/' && charAt(line, i + 1) === '/') return { comment: { kind: 'line', at: i }, swallowedAt: -1 };
		if (c === '/' && charAt(line, i + 1) === '*') return { comment: { kind: 'block', at: i }, swallowedAt: -1 };
		if (c === '/' && !skipped.has(i) && opensRegexLiteral(line, i)) {
			const closes = scanRegexLiteral(line, i);
			if (closes > -1) {
				literals.push(i);
				tail.length = 0;
				i = closes;
			}
			continue;
		}
	}
	// A line that ends inside a string means the last regex literal swallowed that string's opening quote.
	const swallowed = deadEnd || (quote === '`' ? reader.backticksPaired : quote !== '');
	if (!swallowed) return { comment: null, swallowedAt: -1 };
	for (const state of tail) deadEnds.add(state);
	return { comment: null, swallowedAt: literals.length > 0 ? (literals[literals.length - 1] ?? -1) : -1 };
}

function findCommentStart(line: string): CommentStart | null {
	const reader: Reader = {
		line,
		skipped: new Set(),
		literals: [],
		backticksPaired: (line.match(/(?<!\\)`/g) ?? []).length % 2 === 0,
		deadEnds: new Set(),
	};
	let at = 0;
	for (;;) {
		const attempt = scanForComment(reader, at);
		if (attempt.comment !== null || attempt.swallowedAt === -1) return attempt.comment;
		reader.skipped.add(attempt.swallowedAt);
		reader.literals.pop();
		at = attempt.swallowedAt;
	}
}

/**
 * Returns, per line, the comment text on it or null: line, block and end-of-line comments, read outside strings
 * and regex literals. A fenced example inside a block comment is not comment text.
 */
export function slashCommentLines(source: string): Array<CommentLine | null> {
	const out: Array<CommentLine | null> = [];
	let inBlock = false;
	let inFence = false;
	for (const line of source.split('\n')) {
		if (inBlock) {
			if (/^\s*\*?\s*```/.test(line)) inFence = !inFence;
			const end = line.indexOf('*/');
			const body = (end === -1 ? line : line.slice(0, end)).replace(/^\s*\*+\s?/, '').trim();
			out.push({ text: inFence ? '' : body, whole: true });
			inBlock = end === -1;
			continue;
		}
		const found = findCommentStart(line);
		if (found === null) {
			out.push(null);
			continue;
		}
		const before = line.slice(0, found.at).trim();
		const whole = before === '' || before === '{';
		if (found.kind === 'line') {
			out.push({ text: line.slice(found.at).replace(/^\/\/+\s?/, ''), whole });
			continue;
		}
		const closes = line.indexOf('*/', found.at + 2);
		const body = (closes === -1 ? line.slice(found.at + 2) : line.slice(found.at + 2, closes)).replace(/^\*+\s?/, '').trim();
		out.push({ text: body, whole });
		inBlock = closes === -1;
	}
	return out;
}
