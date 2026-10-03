// prohibitions.ts — what never stands in a comment, one entry per rule of the code-documentation ADR.

/** Everything a prohibition may look at besides the comment text. */
export interface ProhibitionContext {
	line: string;
	whole: boolean;
	personNames: readonly string[];
}

type Prohibition = {
	key: string;
	label: string;
	message: string;
	matches: (text: string, context: ProhibitionContext) => boolean;
};

const realDate = /\b\d{1,2}\.\d{1,2}\.(19|20)\d{2}\b|\b(19|20)\d{2}-\d{2}-\d{2}\b/;
const pendingMarker = /\b(TODO|open|pending|follow-up|blocked)\b|→|->/i;
const directive =
	/^\s*(eslint-|@ts-|prettier-|istanbul |c8 |v8 |biome-|cspell:|shellcheck |type: ?ignore|@vitest-environment)/;
const retrospect = new RegExp(
	[
		'\\b(previously|formerly|originally)\\b',
		'\\bused to\\b',
		'\\bno longer\\b',
		'\\b(was|were|got|has been|have been)\\s+(removed|renamed|replaced|moved|deleted|changed|rewritten|added)\\b',
		'\\b(first|old|earlier|initial)\\s+(version|implementation|draft)\\b',
		'\\bas before\\b',
		'\\buntil\\s+(the\\s+)?(refactor|rewrite|commit|PIX-\\d)',
		'\\bin the past\\b',
	].join('|'),
	'i',
);
const deadStatement = [
	/^(const|let|var|function|class|import|export|delete)\s+[\w${[].*[;{]\s*$/,
	/^(return|await|throw|new)\s+\S.*;\s*$/,
	/^(if|for|while|switch|catch)\s*\(.*\)\s*\{?\s*$/,
	/^[\w$.[\]]+\s*=[^=>].*;\s*$/,
	/^[\w$.]+\([^)]*\)\s*;\s*$/,
	/^\}\s*(else|catch|finally)?\s*\{?\s*$/,
];

/** The rule set read by the comment gate and its probe; each entry is one prohibition. */
export const prohibitions: readonly Prohibition[] = [
	{
		key: 'date',
		label: 'date',
		message: 'What git knows does not stand in the source; a comment says in the present tense why the code is so.',
		matches: (text) => !/https?:\/\//.test(text) && realDate.test(text),
	},
	{
		key: 'person',
		label: 'person name',
		message: 'Who decided something stands in the ticket and in git; the comment says why it holds.',
		matches: (text, context) =>
			context.personNames.some((name) =>
				new RegExp(`(?<![\\w./-])${name}(?![\\w/-])(?!\\.\\w)(?!\\s+Code\\b)`, 'i').test(text),
			),
	},
	{
		key: 'ticket',
		label: 'ticket number as history',
		message: 'A card key may mark an open point, never record where a line came from.',
		matches: (text) => /\bPIX-\d+\b(?!\*)/.test(text) && !pendingMarker.test(text),
	},
	{
		key: 'retrospect',
		label: 'retrospective',
		message: "Yesterday's code is in git; a comment describes the state of today.",
		matches: (text) => retrospect.test(text),
	},
	{
		key: 'banner',
		label: 'banner line',
		message: 'A separator line structures nothing the file does not already structure.',
		matches: (text) => /^[-=_*~#─]{4,}$/.test(text.trim()) || /^[-=_*~#─]{2,}\s.*\s[-=_*~#─]{2,}$/.test(text.trim()),
	},
	{
		key: 'trailing',
		label: 'end-of-line comment',
		message: 'What needs saying stands on the line above or in the JSDoc block.',
		matches: (text, context) => !context.whole && !directive.test(text),
	},
	{
		key: 'marker',
		label: 'marker without a card',
		message: 'A TODO carries a card key; FIXME, HACK and XXX do not exist.',
		matches: (text) => /\b(FIXME|HACK|XXX)\b/.test(text) || (/\bTODO\b/.test(text) && !/\bPIX-\d+\b/.test(text)),
	},
	{
		key: 'directive',
		label: 'directive without a reason',
		message: '`eslint-disable` and `@ts-expect-error` carry their reason on the same line.',
		matches: (text) =>
			(/^\s*eslint-disable/.test(text) && !/\s--\s+\S/.test(text)) || /^\s*@ts-(expect-error|ignore)\s*$/.test(text),
	},
	{
		key: 'dead-code',
		label: 'commented-out code',
		message: 'Dead code is deleted; git keeps it.',
		matches: (text) => {
			const body = text.trim();
			return body.length > 0 && deadStatement.some((shape) => shape.test(body));
		},
	},
];
