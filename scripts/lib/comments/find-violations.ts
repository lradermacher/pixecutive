// find-violations.ts — checks one file against the code-documentation rules.

import type { CommentLine } from './comment-line.ts';
import { hashCommentLines } from './hash-comment-lines.ts';
import { prohibitions } from './prohibitions.ts';
import { slashCommentLines } from './slash-comment-lines.ts';

/** One rule broken at one line; a warning does not fail the gate. */
export interface Violation {
	file: string;
	line: number;
	rule: string;
	label: string;
	message: string;
	severity: 'error' | 'warning';
	text: string;
}

const maxHeadLines = 3;
const maxBodyLines = 3;
const declaration =
	/^(export\s|default\s|function\s|async\s+function\s|class\s|abstract\s|interface\s|type\s|enum\s|@|(const|let|var)\s+|[\w-]+\s*\(\)\s*\{)/;
const dataEntry = /^(\{|\[|\.\.\.|["'`]|[\w$]+\??\s*:|\[[^\]]+\]\s*:)/;
const exportedFunction = /^export\s+(default\s+)?(async\s+)?(function|class|abstract\s+class)\b|^export\s+const\s+\w+\s*(:[^=]+)?=\s*(async\s*)?\(/;
const requiredHeadPaths = [/^scripts\/(check|probe|install|generate)-/, /^\.claude\/hooks\//, /^\.githooks\//];

function usesHashComments(path: string): boolean {
	return path.endsWith('.sh') || path.startsWith('.githooks/');
}

function headRows(lines: readonly string[], comments: ReadonlyArray<CommentLine | null>): number[] {
	const rows: number[] = [];
	let pending: number[] = [];
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? '';
		const comment = comments[index] ?? null;
		if (line.trim() === '' || (index === 0 && line.startsWith('#!'))) {
			rows.push(...pending);
			pending = [];
			continue;
		}
		if (comment === null || !comment.whole) return declaration.test(line.trim()) ? rows : rows.concat(pending);
		pending.push(index);
	}
	return rows.concat(pending);
}

function hasContent(comment: CommentLine | null | undefined): boolean {
	return comment !== null && comment !== undefined && comment.text.trim() !== '';
}

function jsDocBefore(lines: readonly string[], index: number): string | null {
	let row = index - 1;
	while (row >= 0 && (lines[row] ?? '').trim() === '') row -= 1;
	if (!(lines[row] ?? '').trim().endsWith('*/')) return null;
	let start = row;
	while (start >= 0 && !(lines[start] ?? '').trim().startsWith('/*')) start -= 1;
	if (start < 0 || !(lines[start] ?? '').trim().startsWith('/**')) return null;
	return lines.slice(start, row + 1).join('\n');
}

function bodyOf(lines: readonly string[], index: number): string {
	const end = lines.findIndex((line, row) => row > index && /^\}/.test(line));
	return lines.slice(index, end === -1 ? lines.length : end + 1).join('\n');
}

/**
 * Checks one file. `onlyLines` holds the 1-based lines this change wrote; findings elsewhere are dropped, and a length
 * rule is an error only when the change touched the passage. Without `onlyLines` the whole file is checked and length
 * rules only warn.
 */
export function findViolations(
	file: string,
	source: string,
	onlyLines: ReadonlySet<number> | null,
	personNames: readonly string[],
): Violation[] {
	const lines = source.split('\n');
	const comments = usesHashComments(file) ? hashCommentLines(source) : slashCommentLines(source);
	const findings: Array<Violation & { rows?: number[] }> = [];
	const lengthSeverity = onlyLines === null ? 'warning' : 'error';
	let block: number[] = [];

	const closeBlock = (): void => {
		const first = block[0];
		const last = block[block.length - 1];
		if (first === undefined || last === undefined) return;
		const content = block.filter((row) => hasContent(comments[row])).length;
		const opener = lines[first] ?? '';
		const trimmed = opener.trimStart();
		const after = lines.slice(last + 1).find((line) => line.trim() !== '') ?? '';
		const isBody = trimmed !== opener && !trimmed.startsWith('/**') && !dataEntry.test(after.trim());
		if (isBody && content > maxBodyLines) {
			findings.push({
				file,
				line: first + 1,
				rule: 'body-length',
				label: 'body comment',
				message: `A comment inside a body has at most ${maxBodyLines} lines and explains business logic; this one has ${content}.`,
				severity: lengthSeverity,
				text: opener.trim(),
				rows: [...block],
			});
		}
		block = [];
	};

	comments.forEach((comment, index) => {
		if (comment === null || !comment.whole) closeBlock();
		else block.push(index);
		if (comment === null) return;
		const context = { line: lines[index] ?? '', whole: comment.whole, personNames };
		for (const prohibition of prohibitions) {
			if (!prohibition.matches(comment.text, context)) continue;
			findings.push({
				file,
				line: index + 1,
				rule: prohibition.key,
				label: prohibition.label,
				message: prohibition.message,
				severity: 'error',
				text: (lines[index] ?? '').trim(),
			});
		}
	});
	closeBlock();

	const head = headRows(lines, comments);
	const headContent = head.filter((row) => hasContent(comments[row])).length;
	if (headContent > maxHeadLines) {
		findings.push({
			file,
			line: (head[0] ?? 0) + 1,
			rule: 'head-length',
			label: 'file head',
			message: `A file head has at most ${maxHeadLines} lines; this one has ${headContent}.`,
			severity: lengthSeverity,
			text: (lines[head[0] ?? 0] ?? '').trim(),
			rows: head,
		});
	}
	const firstLine = lines[0]?.startsWith('#!') === true ? 1 : 0;
	if (requiredHeadPaths.some((pattern) => pattern.test(file)) && !hasContent(comments[firstLine])) {
		findings.push({
			file,
			line: 1,
			rule: 'head-missing',
			label: 'missing file head',
			message: 'A script, hook or gate starts with a head that says what it rejects.',
			severity: 'error',
			text: (lines[0] ?? '').trim(),
		});
	}

	if (file.endsWith('.ts')) {
		lines.forEach((line, index) => {
			if (!exportedFunction.test(line)) return;
			const doc = jsDocBefore(lines, index);
			if (doc === null) {
				findings.push({
					file,
					line: index + 1,
					rule: 'jsdoc',
					label: 'export without JSDoc',
					message: 'An exported function, method or class carries a JSDoc block: what it does and what the caller must know.',
					severity: 'error',
					text: line.trim(),
				});
				return;
			}
			if (/\bthrow\s/.test(bodyOf(lines, index)) && !/@throws\b/.test(doc)) {
				findings.push({
					file,
					line: index + 1,
					rule: 'throws',
					label: 'throws without @throws',
					message: 'A function that throws says so with @throws; no signature shows it.',
					severity: 'error',
					text: line.trim(),
				});
			}
		});
	}

	return findings
		.filter((finding) =>
			onlyLines === null
				? true
				: finding.rows !== undefined
					? finding.rows.some((row) => onlyLines.has(row + 1))
					: finding.rule === 'head-missing' || onlyLines.has(finding.line),
		)
		.map(({ rows: _rows, ...finding }) => finding);
}
