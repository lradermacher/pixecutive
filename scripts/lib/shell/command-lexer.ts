// command-lexer.ts — decides for both shell guards whether a pattern hit is a CALL or only a MENTION.
// Mentioned means after a text, reader or search command, in a comment or in a heredoc body; never just quoted.

/** @aggregate The masks, the segment bounds and the mention test are one reading of a command and must not drift. */

/** One flag per character of a command, from a single left-to-right pass that reads it the way the shell does. */
export interface CommandMasks {
	quoted: boolean[];
	comment: boolean[];
	escaped: boolean[];
	heredoc: boolean[];
	substitution: boolean[];
}

// `&` next to `>` is a redirect (`&>`, `>&2`), not a boundary; `echo >&2 "…"` would otherwise fall apart.
const segmentSplit = /\|\||&&|;|\|(?!\|)|(?<!>)&(?!>)|\n/g;
const prefix = '^\\s*(?:[A-Za-z_][A-Za-z0-9_]*=\\S*\\s+)*(?:sudo\\s+)?(?:[^\\s;|&]*/)?';
// A closed list on purpose: what counts as harmless must be readable here. `find` searches like `grep` does.
const searchHead = new RegExp(`${prefix}(?:grep|egrep|fgrep|zgrep|rg|ag|ack|find|git\\s+(?:grep|log|show))\\b`);
// Their quoted argument is a text; without them a guard would reject every commit that ships it.
const messageHead = new RegExp(
	`${prefix}(?:git\\s+(?:commit|tag|notes|stash\\s+push)|gh\\s+(?:pr|issue|release)\\s+(?:create|comment|edit))\\b`,
);
// `echo` and `printf` only take text; the readers open a file, which matters to a rule that forbids reading.
// `tee` is neither: it writes its arguments as files.
const outputHead = new RegExp(`${prefix}(?:echo|printf)\\b`);
const readerHead = new RegExp(`${prefix}(?:cat|bat|nl|head|tail|less|more)\\b`);

/**
 * `<<WORD`, `<<-WORD`, `<<\WORD`, `<<'WORD'`, `<<"WORD"`, never `<<<`. Group 1 is the dash, group 4 the delimiter.
 * bash takes almost any word as a delimiter (`E-O-F`, `EOF.`); a narrower set would let those past every lock.
 */
export const heredocOpener = /<<(?!<)(-?)\s*(\\?)(["']?)([A-Za-z0-9_][A-Za-z0-9_.-]*)\3/;
const heredocAt = new RegExp(heredocOpener.source, 'y');

const cache = new Map<string, CommandMasks>();

function closingParen(text: string, cursor: number, countsPlain: boolean): number {
	let depth = 1;
	let index = cursor;
	while (index < text.length && depth > 0) {
		if (!countsPlain && text.startsWith('$(', index)) {
			depth += 1;
			index += 2;
			continue;
		}
		if (countsPlain && text[index] === '(') depth += 1;
		else if (text[index] === ')') depth -= 1;
		index += 1;
	}
	return Math.min(index, text.length);
}

function mark(mask: boolean[], from: number, to: number): void {
	for (let index = from; index < to; index += 1) mask[index] = true;
}

/**
 * Lexes `command` once and returns its masks. Each of these forms lets a real call through when it is not read as
 * shell, because an unclosed quote swallows every later boundary: an escaped quote outside quotes, `$'…'`, a heredoc
 * body with an apostrophe, a here-string, an escaped `<`, an arithmetic shift. The result is cached per text.
 */
export function lexCommand(command: string): CommandMasks {
	const cached = cache.get(command);
	if (cached !== undefined) return cached;
	const text = command;
	const size = text.length;
	const masks: CommandMasks = {
		quoted: new Array<boolean>(size).fill(false),
		comment: new Array<boolean>(size).fill(false),
		escaped: new Array<boolean>(size).fill(false),
		heredoc: new Array<boolean>(size).fill(false),
		substitution: new Array<boolean>(size).fill(false),
	};
	let quote: string | null = null;
	let inComment = false;
	const pending: Array<{ strip: boolean; delimiter: string }> = [];
	let arithmetic = 0;
	let backtick: number | null = null;
	let index = 0;
	while (index < size) {
		const char = text[index] ?? '';

		// A heredoc body is not code: an apostrophe in it (`it's`) would open a quote that never closes.
		if (char === '\n' && pending.length > 0 && quote === null && !inComment) {
			index += 1;
			while (pending.length > 0) {
				const { strip, delimiter } = pending.shift() ?? { strip: false, delimiter: '' };
				while (index < size) {
					let lineEnd = text.indexOf('\n', index);
					if (lineEnd === -1) lineEnd = size;
					const line = text.slice(index, lineEnd);
					if ((strip ? line.trim() : line) === delimiter) {
						index = Math.min(lineEnd + 1, size);
						break;
					}
					mark(masks.heredoc, index, Math.min(lineEnd + 1, size));
					index = Math.min(lineEnd + 1, size);
				}
			}
			continue;
		}

		if (inComment) {
			if (char === '\n') inComment = false;
			else masks.comment[index] = true;
			index += 1;
			continue;
		}

		// `$( … )` expands inside double quotes too; `$((` is arithmetic, not a substitution.
		if (quote === '"' && text.startsWith('$(', index) && !text.startsWith('$((', index)) {
			const end = closingParen(text, index + 2, false);
			mark(masks.quoted, index, end);
			mark(masks.substitution, index, end);
			index = end;
			continue;
		}

		if (quote !== null) {
			masks.quoted[index] = true;
			if (char === '\\' && (quote === '"' || quote === "$'") && index + 1 < size) {
				masks.quoted[index + 1] = true;
				masks.escaped[index + 1] = true;
				index += 2;
				continue;
			}
			if (char === quote[quote.length - 1]) quote = null;
			index += 1;
			continue;
		}

		if (char === '\\' && index + 1 < size) {
			masks.escaped[index + 1] = true;
			index += 2;
			continue;
		}

		// `git commit -m "state $(git branch -f main HEAD)"` moves main: a substitution is always a call.
		if (text.startsWith('$(', index) && !text.startsWith('$((', index)) {
			const end = closingParen(text, index + 2, false);
			mark(masks.substitution, index, end);
			index = end;
			continue;
		}

		if (text.startsWith("$'", index)) {
			quote = "$'";
			masks.quoted[index] = true;
			masks.quoted[index + 1] = true;
			index += 2;
			continue;
		}

		if (char === "'" || char === '"') {
			quote = char;
			masks.quoted[index] = true;
			index += 1;
			continue;
		}

		// Right after a command boundary too: `git commit -m x;# rest` is a comment for bash.
		const before = text[index - 1] ?? '';
		if (char === '#' && (index === 0 || /\s/.test(before) || ';|&('.includes(before))) {
			inComment = true;
			masks.comment[index] = true;
			index += 1;
			continue;
		}

		// Arithmetic first: `echo $((1<<N))` is a shift; read as a heredoc that never ends, every lock would fall.
		if (text.startsWith('$((', index)) {
			arithmetic += 1;
			index += 3;
			continue;
		}
		if (text.startsWith('((', index) && arithmetic === 0) {
			arithmetic += 1;
			index += 2;
			continue;
		}
		if (text.startsWith('))', index) && arithmetic > 0) {
			arithmetic -= 1;
			index += 2;
			continue;
		}

		// `cat <(git clean -f -d -x)` deletes although `cat` is a reader: the same root as `$( … )`.
		if (text.startsWith('<(', index) || text.startsWith('>(', index)) {
			const end = closingParen(text, index + 2, true);
			mark(masks.substitution, index, end);
			index = end;
			continue;
		}

		// A backtick pair is a substitution: `echo \`cat key\`` reads the key. A code quote in docs is quoted.
		if (char === '`') {
			if (backtick === null) {
				backtick = index;
			} else {
				mark(masks.substitution, backtick, index + 1);
				backtick = null;
			}
			index += 1;
			continue;
		}

		if (char === '<' && arithmetic === 0) {
			heredocAt.lastIndex = index;
			const opener = heredocAt.exec(text);
			if (opener !== null) {
				pending.push({ strip: opener[1] === '-', delimiter: opener[4] ?? '' });
				index = heredocAt.lastIndex;
				continue;
			}
			// The whole run of `<` is skipped, or `<<<EOF` would match a heredoc at its second `<`.
			while (index < size && text[index] === '<') index += 1;
			continue;
		}

		index += 1;
	}
	if (cache.size > 16) cache.clear();
	cache.set(command, masks);
	return masks;
}

/**
 * Returns `[begin, end]` of the command segment that holds `start`. Boundaries are `;`, `&&`, `||`, `|`, `&` and a
 * newline, but only where they are code: not quoted, commented, escaped (a line continuation) or in a heredoc body.
 */
export function segmentBounds(text: string, start: number): [number, number] {
	const { quoted, comment, escaped, heredoc } = lexCommand(text);
	let begin = 0;
	for (const match of text.matchAll(segmentSplit)) {
		const position = match.index;
		if (quoted[position] || comment[position] || escaped[position] || heredoc[position]) continue;
		if (position >= start) return [begin, position];
		begin = position + match[0].length;
	}
	return [begin, text.length];
}

// The target is the word right after the operator; `>&2` targets a descriptor, and an escaped `\>` is no redirect.
function isRedirectTarget(segment: string, offset: number, stop: number, escaped: readonly boolean[]): boolean {
	const { quoted } = lexCommand(segment);
	for (let position = segment.indexOf('>'); position !== -1; position = segment.indexOf('>', position + 1)) {
		if (quoted[position] || escaped[position]) continue;
		let cursor = position + 1;
		while (cursor < segment.length && '>|'.includes(segment[cursor] ?? '')) cursor += 1;
		while (cursor < segment.length && ' \t'.includes(segment[cursor] ?? '')) cursor += 1;
		if (segment[cursor] === '&') continue;
		let end = cursor;
		while (end < segment.length && !' \t;|&\n'.includes(segment[end] ?? '')) end += 1;
		if (offset < end && stop > cursor) return true;
	}
	return false;
}

// Any pipe onward cancels the exception: a list of interpreters (`| command sh`, `| cat | sh`) is never complete.
function pipedOnward(text: string, end: number): boolean {
	return /^\s*\|(?!\|)/.test(text.slice(end));
}

/**
 * Returns true when the hit at `start`..`stop` is only mentioned, not called: after `echo`/`printf` or a reader, in a
 * comment or heredoc body, in a quoted commit or PR message, or after a search command. A substitution, a redirect
 * target and a pipe onward are always calls. `readingCounts = false` drops the reader and search exceptions, for a
 * rule that forbids reading; a quoted search pattern stays text even then.
 */
export function onlyMentioned(text: string, start: number, stop: number = start + 1, readingCounts = true): boolean {
	const masks = lexCommand(text);
	if (masks.substitution[start]) return false;
	if (masks.comment[start]) return true;
	// The end of the hit decides: `\bgit\b` anchors at the outer `git`, and its flag may sit in the heredoc body.
	const last = stop - 1;
	if (last >= 0 && last < masks.heredoc.length && masks.heredoc[last]) return true;
	const [begin, end] = segmentBounds(text, start);
	const segment = text.slice(begin, end);
	if (messageHead.test(segment)) {
		const inner = lexCommand(segment);
		const window: number[] = [];
		for (let index = Math.max(start - begin, 0); index < Math.min(stop - begin, inner.quoted.length); index += 1) {
			window.push(index);
		}
		// A substitution inside the message runs before the text even exists.
		if (window.some((index) => inner.substitution[index])) return false;
		if (window.some((index) => inner.quoted[index])) return true;
	}
	if (isRedirectTarget(segment, start - begin, stop - begin, masks.escaped.slice(begin, end))) return false;
	if (outputHead.test(segment)) return !pipedOnward(text, end);
	if (searchHead.test(segment) && !readingCounts) return lexCommand(segment).quoted[start - begin] === true;
	if (!readingCounts) return false;
	if (searchHead.test(segment)) return true;
	if (readerHead.test(segment)) return !pipedOnward(text, end);
	return false;
}

/** Returns true when `pattern` occurs at least once in `text` as a real call, not only as a mention. */
export function hit(pattern: RegExp, text: string, readingCounts = true): boolean {
	const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
	for (const match of text.matchAll(global)) {
		if (!onlyMentioned(text, match.index, match.index + match[0].length, readingCounts)) return true;
	}
	return false;
}
