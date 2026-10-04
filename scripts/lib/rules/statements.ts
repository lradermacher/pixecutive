// statements.ts — what a rule carrier says, normalized, so two carriers that say the same thing can be found.
// Compared are exact strings of normalized headings, long lines and their first meaningful words, never a similarity
// measure: a gate with false alarms is switched off, not obeyed (ADR 0008).

/** One statement of a carrier: heading or line, its normalized form, its wording and its first meaningful words. */
export interface Statement {
	carrier: string;
	kind: 'heading' | 'line';
	normalized: string;
	wording: string;
	trigger: string | null;
}

const triggerWords = 3;
const fillerWords = new Set(
	('a an the and or but nor never only also in on at to of for from with by into is are be was were will who what ' +
		'where how when if then that this these those it its as not no so each every any all one its their our we you')
		.split(' '),
);
const quoted = /“[^”]*”|"[^"]*"|‘[^’]*’/g;

function normalize(line: string): string {
	return line
		.replace(quoted, ' ')
		.replace(/^#+\s*/, '')
		.replace(/`([^`]*)`/g, '$1')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.toLowerCase()
		.replace(/[^\p{L}\p{N} ]+/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function trigger(normalized: string): string | null {
	const words = normalized.split(' ').filter((word) => word.length > 1 && !fillerWords.has(word));
	return words.length < triggerWords ? null : words.slice(0, triggerWords).join(' ');
}

/**
 * Returns the rule headings and long lines of one carrier body. Code blocks, HTML comments, tables, block quotes and
 * quoted spans are evidence, not statements, and are skipped. A quote is how an incident names the rule it broke.
 * A non-empty `description` is read as one more heading: a memory file has no rule headings, its description is what
 * it states. Rule carriers leave it out, because their `summary:` sums up and would be a false alarm.
 */
export function statements(carrier: string, body: string, description = ''): Statement[] {
	const found: Statement[] = [];
	let inCode = false;
	let inComment = false;
	for (const raw of body.split('\n')) {
		const line = raw.trimEnd();
		if (line.trim().startsWith('```')) inCode = !inCode;
		if (inCode || line.trim().startsWith('```')) continue;
		if (line.includes('<!--')) inComment = true;
		if (inComment) {
			if (line.includes('-->')) inComment = false;
			continue;
		}
		if (/^\s*\|/.test(line) || line.trimStart().startsWith('>')) continue;
		const heading = /^#{2,}\s+(.*)$/.exec(line);
		const normalized = normalize(heading ? (heading[1] ?? '') : line);
		if (heading ? normalized.length < 12 : normalized.length < 40) continue;
		found.push({
			carrier,
			kind: heading ? 'heading' : 'line',
			normalized,
			wording: line.trim(),
			trigger: heading ? trigger(normalized) : null,
		});
	}
	const described = normalize(description);
	if (described.length >= 12) {
		const wording = description.trim();
		found.push({ carrier, kind: 'heading', normalized: described, wording, trigger: trigger(described) });
	}
	return found;
}
