// is-pr-create.ts — says whether a Bash command creates a pull request and which `--head` branch it names.
// One place, one answer: the gate before a pull request and its probe both ask here.

const heredocStart = /<<-?\s*['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?/;
const assignment = /^[A-Za-z_][A-Za-z0-9_]*=/;
const punctuation = ';&|';

// A heredoc body is text: reading it would reject every doc that only mentions the command. The opener stays.
function withoutHeredocBodies(text: string): string {
	const kept: string[] = [];
	let closing: string | null = null;
	for (const line of text.split('\n')) {
		if (closing !== null) {
			if (line.trim() === closing) closing = null;
			continue;
		}
		kept.push(line);
		closing = heredocStart.exec(line)?.[1] ?? null;
	}
	return kept.join('\n');
}

// Splits like a POSIX shell: quotes removed, backslash escapes, and with `splitPunctuation` every run of `;&|` is a
// token of its own. Returns null on an unclosed quote or a trailing backslash, where the caller splits on blanks.
function shellWords(text: string, splitPunctuation: boolean): string[] | null {
	const words: string[] = [];
	let current = '';
	let started = false;
	const finish = (): void => {
		if (started) words.push(current);
		current = '';
		started = false;
	};
	for (let index = 0; index < text.length; index += 1) {
		const char = text[index] ?? '';
		if (/\s/.test(char)) {
			finish();
		} else if (splitPunctuation && punctuation.includes(char)) {
			finish();
			let run = char;
			while (punctuation.includes(text[index + 1] ?? 'x')) {
				index += 1;
				run += text[index];
			}
			words.push(run);
		} else if (char === "'") {
			const close = text.indexOf("'", index + 1);
			if (close === -1) return null;
			current += text.slice(index + 1, close);
			started = true;
			index = close;
		} else if (char === '"') {
			started = true;
			index += 1;
			while (index < text.length && text[index] !== '"') {
				if (text[index] === '\\' && '\\"$`\n'.includes(text[index + 1] ?? 'x')) index += 1;
				current += text[index];
				index += 1;
			}
			if (index >= text.length) return null;
		} else if (char === '\\') {
			if (index + 1 >= text.length) return null;
			index += 1;
			current += text[index];
			started = true;
		} else {
			current += char;
			started = true;
		}
	}
	finish();
	return words;
}

/**
 * Returns whether `command` runs `gh pr create` as a command of its own (only assignments may stand before it) and
 * the branch its `--head` names, '' without one. A newline is a command boundary; the head is read from the words,
 * so a `--head` inside a quoted `--body` never wins against the real one.
 */
export function isPrCreate(command: string): { creates: boolean; head: string } {
	const normalized = withoutHeredocBodies(command).replaceAll('\n', ' ; ').split(/\s+/).filter(Boolean).join(' ');
	const tokens = shellWords(normalized, true) ?? normalized.split(' ');
	const boundary = (index: number): number => {
		let start = index;
		while (start > 0 && ![...(tokens[start - 1] ?? '')].every((char) => punctuation.includes(char))) start -= 1;
		return start;
	};
	const creates = tokens.some(
		(token, index) =>
			token === 'gh' &&
			tokens[index + 1] === 'pr' &&
			tokens[index + 2] === 'create' &&
			tokens.slice(boundary(index), index).every((word) => assignment.test(word)),
	);
	if (!creates) return { creates: false, head: '' };
	const words = shellWords(normalized, false) ?? normalized.split(' ');
	for (const [index, word] of words.entries()) {
		if (word.startsWith('--head=')) return { creates: true, head: word.slice('--head='.length) };
		const next = words[index + 1];
		if (word === '--head' && next !== undefined && !next.startsWith('--')) return { creates: true, head: next };
	}
	return { creates: true, head: '' };
}
