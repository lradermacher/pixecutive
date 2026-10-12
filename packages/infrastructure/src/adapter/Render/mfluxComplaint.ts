// mfluxComplaint.ts — why mflux failed, read from its error output: its last error, else its last plain line, else a warning.
import { StringDecoder } from 'node:string_decoder';
import { mfluxProgress } from './mfluxProgress.ts';

/** A line that names an error, such as `ValueError: width must be even` or `uncaught exception of type std::runtime_error`. */
const errorLine = /\b\w*(error|exception)\b/i;

/**
 * The label of a warning, such as `UserWarning:` or the logging prefix `WARNING:`; it says why only when nothing else
 * does. Only the label counts: an error whose message speaks of a warning stays an error.
 */
const warningLabel = /\b\w*warning:/i;

/**
 * The line Python prints before a traceback it cannot raise any further, as when an object is freed or the process shuts
 * down; the error under it is not why mflux failed.
 */
const ignoredException = /^Exception ignored\b/;

/** The head of a traceback; inside an ignored one it belongs to the traceback, not to its end. */
const tracebackHead = /^Traceback \(most recent call last\):/;

/**
 * Where Python says a warning was raised, `path/to/file.py:12: ` or `<stdin>:3: `, followed by the warning's category;
 * the path may hold spaces, colons or a drive letter, and the file may be named `error.py`. A line that only holds a
 * `:12: ` somewhere, as a clock time in an error, is no warning's location.
 */
const warningSource = /^(?:.+?\.py|<[^>]+>):\d+: (?=\w*Warning:)/;

/** The marks Python draws under the failing part of a source line in a traceback, such as `~~~~^^^^`. */
const traceMarks = /^\s*[~^]+\s*$/;

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
 * The longest piece of a line kept while it has not ended. It holds a complaint behind the padding of any bar tqdm
 * clears, which is as wide as the terminal, and keeps a line that never ends from filling the memory.
 */
const pieceLength = 4096;

/**
 * Listens to mflux's error output chunk by chunk. A line can arrive in pieces and a character can be cut between two
 * writes, so the output is decoded as one stream and the piece after the last line break waits for the rest. The
 * reason is the last error line, else the last line that is no warning, else the last warning; the line that ends a
 * traceback counts as an error line whatever it names. It follows the shape Python gives its output: an indented line
 * continues the one above it, an exception group is read inside its frame,
 * and the error of a traceback Python cannot raise any further, when an object is freed or the process shuts down,
 * does not count.
 */
export class MfluxComplaint {
	private readonly decoder = new StringDecoder('utf8');
	private pending = '';
	private lastError = '';
	private lastLine = '';
	private lastWarning = '';
	private barSteps = -1;
	private highestStep = -1;
	private insideIgnored = false;
	private raising = false;

	/** Takes the next chunk of the error output. */
	listen(chunk: Buffer): void {
		const parts = `${this.pending}${this.decoder.write(chunk)}`.split(/[\r\n]+/);
		// Only the start of a line counts. It is kept as written, because the padding and the indentation it starts with
		// decide how the line is read once it has ended.
		this.pending = (parts.pop() ?? '').slice(0, pieceLength);
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
		// Inside a traceback the indentation is Python's own: a statement over several lines keeps its deep indentation
		// there, and tqdm cleared its bars before the traceback began.
		const bare = raw.replace(terminalControl, '');
		const cleared = this.raising ? bare : bare.replace(padding, '');
		// Inside an exception group every line stands behind `| `; without the frame it reads like any other line.
		const line = groupFrame.test(cleared) ? cleared.replace(groupFrame, '') : cleared;
		if (traceMarks.test(line)) return;
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
		// A bar that runs again means the traceback above it ended without its last line.
		this.raising = false;
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
			this.raising = false;
			this.insideIgnored = true;
			return;
		}
		if (this.insideIgnored) {
			// An ignored traceback ends with its first line that is neither its head nor indented, whatever it names.
			if (!tracebackHead.test(one)) this.insideIgnored = false;
			return;
		}
		if (this.raising) {
			// The first line under a traceback that is not indented is the exception that ended it, even a warning that
			// `-W error` turned into one.
			this.raising = false;
			this.lastError = one;
			return;
		}
		if (tracebackHead.test(one)) this.raising = true;
		if (isWarning(one)) this.lastWarning = one;
		else if (errorLine.test(one)) this.lastError = one;
		else this.lastLine = one;
	}
}

/** A warning whose label comes before any error it names, as in `UserWarning: ConnectionError, retried`. */
function isWarning(line: string): boolean {
	const said = line.replace(warningSource, '');
	const label = warningLabel.exec(said);
	if (label === null) return false;
	const error = errorLine.exec(said);
	return error === null || label.index < error.index;
}
