// mfluxComplaint.ts — why mflux failed, read from its error output: its last error line, else its last other line.
import { StringDecoder } from 'node:string_decoder';

/** A progress line of mflux, such as ` 3/8 [00:41<01:23, 20.8s/it]`, with the step it reached. */
const progressLine = /([0-9]+)\/[0-9]+ \[[^\]]*\]/;

/** A line that names an error, such as `ValueError: width must be even`; a warning after it does not hide it. */
const errorLine = /\b\w*(Error|Exception)\b/;

/** How much of a line without a break is kept; a complaint is cut to 300 characters anyway. */
const pendingLimit = 4096;

/**
 * Listens to mflux's error output chunk by chunk. A line can arrive in pieces and a character can be cut between two
 * writes, so the output is decoded as one stream and the piece after the last line break waits for the rest.
 */
export class MfluxComplaint {
	private readonly decoder = new StringDecoder('utf8');
	private pending = '';
	private lastError = '';
	private lastLine = '';
	private highestStep = -1;

	/** Takes the next chunk of the error output. */
	listen(chunk: Buffer): void {
		const parts = `${this.pending}${this.decoder.write(chunk)}`.split(/[\r\n]+/);
		this.pending = (parts.pop() ?? '').slice(-pendingLimit);
		for (const part of parts) this.hear(part);
	}

	/** The complaint once the output has ended, one line of at most 300 characters; empty when mflux said nothing. */
	finish(): string {
		this.hear(`${this.pending}${this.decoder.end()}`);
		this.pending = '';
		return this.lastError === '' ? this.lastLine : this.lastError;
	}

	private hear(line: string): void {
		// An error mflux reported before a later step did not stop it, so a step past every earlier one clears it; the bar
		// tqdm draws again when the process ends repeats an old step and clears nothing.
		const progress = progressLine.exec(line);
		if (progress !== null) {
			const reached = Number(progress[1]);
			if (reached > this.highestStep) {
				this.highestStep = reached;
				this.lastError = '';
			}
			return;
		}
		// One line of the log's last column: whitespace such as a tab would split the row, so it becomes a space.
		const one = line.replace(/\s+/g, ' ').trim().slice(0, 300);
		if (one === '') return;
		this.lastLine = one;
		if (errorLine.test(one)) this.lastError = one;
	}
}
