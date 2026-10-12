// mfluxComplaint.ts — why mflux failed, read from its error output: its last error, else its last plain line, else a warning.
import { StringDecoder } from 'node:string_decoder';
import { mfluxProgress } from './mfluxProgress.ts';

/** A line that names an error, such as `ValueError: width must be even` or `uncaught exception of type std::runtime_error`. */
const errorLine = /\b\w*(error|exception)\b/i;

/** A warning, such as a `UserWarning` or a logging line `WARNING:root:…`; it says why only when nothing else does. */
const warningLine = /\b\w*warning\b/i;

/** The line Python prints before a traceback it ignores at shutdown; the error under it is not why mflux failed. */
const ignoredException = /^Exception ignored in\b/;

/** A control sequence of the terminal, such as the cursor move tqdm writes when it clears a nested bar. */
// eslint-disable-next-line no-control-regex -- the escape character is what this pattern exists to find
const terminalControl = /\x1b\[[0-9;]*[A-Za-z]/g;

/** The frame of an exception group, `| ` before each line; its `+---` borders are indented and skipped like any. */
const groupFrame = /^\s*\| ?/;

/**
 * tqdm clears a bar line with spaces as wide as the bar; Python indents a traceback by four and a warning's source by
 * two, so a run this long is padding, not indentation.
 */
const padding = /^ {16,}/;

/** The longest complaint the log keeps; a line is cut to it, from its start, where the error names itself. */
const complaintLength = 300;

/**
 * Listens to mflux's error output chunk by chunk. A line can arrive in pieces and a character can be cut between two
 * writes, so the output is decoded as one stream and the piece after the last line break waits for the rest. The
 * reason is the last error line, else the last line that is no warning, else the last warning; it follows the shape
 * Python gives its output: an indented line continues the one above it, an exception group is read inside its frame,
 * and the error of a traceback Python ignores at shutdown does not count.
 */
export class MfluxComplaint {
	private readonly decoder = new StringDecoder('utf8');
	private pending = '';
	private lastError = '';
	private lastLine = '';
	private lastWarning = '';
	private barSteps = -1;
	private highestStep = -1;
	private ignoringNextError = false;

	/** Takes the next chunk of the error output. */
	listen(chunk: Buffer): void {
		const parts = `${this.pending}${this.decoder.write(chunk)}`.split(/[\r\n]+/);
		// Only the start of a line counts: its runs of whitespace are folded first, as the complaint folds them, and then
		// a line that never ends is kept to one leading space and the length of a complaint.
		this.pending = (parts.pop() ?? '').replace(/\s+/g, ' ').slice(0, complaintLength + 1);
		for (const part of parts) this.hear(part);
	}

	/** The complaint once the output has ended, one line of at most 300 characters; empty when mflux said nothing. */
	finish(): string {
		this.hear(`${this.pending}${this.decoder.end()}`);
		this.pending = '';
		if (this.lastError !== '') return this.lastError;
		return this.lastLine === '' ? this.lastWarning : this.lastLine;
	}

	private hear(raw: string): void {
		const cleared = raw.replace(terminalControl, '').replace(padding, '');
		// Inside an exception group every line stands behind `| `; without the frame it reads like any other line.
		const line = groupFrame.test(cleared) ? cleared.replace(groupFrame, '') : cleared;
		const bar = mfluxProgress.exec(line);
		if (bar === null) {
			// An indented line continues the one above it, as the source line under a Python warning or in a traceback.
			if (!/^\s/.test(line)) this.note(line);
			return;
		}
		this.step(Number(bar[1]), Number(bar[2]));
		// Text written right after a bar, without a line break, is a line of its own.
		this.note(line.slice(bar.index + bar[0].length));
	}

	/**
	 * An error mflux reported before a later step did not stop it, so a step past every earlier one of the same bar
	 * clears it. A bar of another length, or one that falls back to an earlier step, is a new bar with its own count;
	 * the bar tqdm draws again when the process ends repeats the same step and clears nothing.
	 */
	private step(reached: number, steps: number): void {
		if (steps !== this.barSteps || reached < this.highestStep) {
			this.barSteps = steps;
			this.highestStep = -1;
		}
		if (reached <= this.highestStep) return;
		this.highestStep = reached;
		this.lastError = '';
	}

	private note(line: string): void {
		// One line of the log's last column: whitespace such as a tab would split the row, so it becomes a space.
		const one = line.replace(/\s+/g, ' ').trim().slice(0, complaintLength);
		if (one === '') return;
		if (ignoredException.test(one)) {
			this.ignoringNextError = true;
			return;
		}
		// A warning stays a warning even when it names an error, so the warning test comes first.
		if (warningLine.test(one)) this.lastWarning = one;
		else if (errorLine.test(one)) this.noteError(one);
		else this.lastLine = one;
	}

	private noteError(line: string): void {
		if (this.ignoringNextError) {
			this.ignoringNextError = false;
			return;
		}
		this.lastError = line;
	}
}
