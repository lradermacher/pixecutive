import { describe, expect, it } from 'vitest';
import { MfluxComplaint } from './mfluxComplaint.ts';

/** The complaint for `chunks`, each handed in as one write of the error output. */
function complaintOf(...chunks: readonly (string | Buffer)[]): string {
	const complaint = new MfluxComplaint();
	for (const chunk of chunks) complaint.listen(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
	return complaint.finish();
}

describe('MfluxComplaint', () => {
	it('answers the last error line, past a warning after it', () => {
		expect(complaintOf('RuntimeError: first\nValueError: second\nUserWarning: resource_tracker\n')).toBe(
			'ValueError: second',
		);
	});

	it('answers the last line when no line names an error', () => {
		expect(complaintOf('loading\nmodel weights look odd\n')).toBe('model weights look odd');
	});

	it('answers nothing when mflux said nothing', () => {
		expect(complaintOf()).toBe('');
	});

	it('keeps a line that arrives in two pieces and one without a final line break', () => {
		expect(complaintOf('ValueError: width ', 'must be even')).toBe('ValueError: width must be even');
	});

	it('keeps a character cut between two writes', () => {
		// The degree sign takes two bytes; the cut falls between them.
		const line = Buffer.from('OSError: 90 °C\n');
		expect(complaintOf(line.subarray(0, 13), line.subarray(13))).toBe('OSError: 90 °C');
	});

	it('clears an error a later step outlived, but not when the bar is drawn again at an old step', () => {
		expect(complaintOf('Error while loading, falling back\n 3/8 [00:03<00:05, 1.0s/it]\nLoading weights\n')).toBe(
			'Loading weights',
		);
		expect(complaintOf(' 0/8 [00:00<?, ?it/s]\rValueError: bad\n\r 0/8 [00:00<?, ?it/s]\nUserWarning: x\n')).toBe(
			'ValueError: bad',
		);
	});

	it('keeps the complaint on one line of at most 300 characters', () => {
		expect(complaintOf('ValueError: width\tmust be even\n')).toBe('ValueError: width must be even');
		expect(complaintOf(`OSError: ${'x'.repeat(1_000_000)}`)).toHaveLength(300);
	});

	it('keeps the start of a line that never ends, where its error names itself', () => {
		const pieces = [
			'ValueError: ',
			...Array.from({ length: 50 }, () => 'x'.repeat(1000)),
			'\nUserWarning: at shutdown\n',
		];
		const said = complaintOf(...pieces);
		expect([said.startsWith('ValueError: x'), said.length]).toEqual([true, 300]);
	});

	it('lets a bar of another length count its own steps', () => {
		const stream =
			' 17/17 [00:02<00:00]\nError while loading a key, falling back\n 1/8 [00:01<00:07]\n 8/8 [00:08<00:00]\nsaving\n';
		expect(complaintOf(stream)).toBe('saving');
	});

	it('clears an error at the first step of the first bar', () => {
		expect(complaintOf('Error while loading, falling back\n 0/8 [00:00<?, ?it/s]\nloading\n')).toBe('loading');
	});

	it('reads text written right after a bar without a line break', () => {
		expect(complaintOf(' 3/8 [00:03<00:05, 1.0s/it]ValueError: out of memory\n')).toBe('ValueError: out of memory');
	});

	it('answers a plain last line before a later warning, and a warning only when nothing else was said', () => {
		expect(complaintOf('Killed while saving\nUserWarning: resource_tracker\n')).toBe('Killed while saving');
		expect(complaintOf('UserWarning: resource_tracker\n')).toBe('UserWarning: resource_tracker');
	});

	it('answers an abort before the two lines of a Python warning printed at shutdown', () => {
		const stream = [
			'libc++abi: terminating due to uncaught exception of type std::runtime_error: [METAL] out of memory',
			'/opt/py/resource_tracker.py:254: UserWarning: resource_tracker: There appear to be 1 leaked semaphore',
			"  warnings.warn('resource_tracker: There appear to be %d '",
			'',
		].join('\n');
		expect(complaintOf(stream)).toBe(
			'libc++abi: terminating due to uncaught exception of type std::runtime_error: [METAL] out of memory',
		);
	});

	it('answers a plain line before a two-line warning, even one that names an error', () => {
		expect(
			complaintOf('Killed while saving\nnet.py:9: UserWarning: ConnectionError, retried\n  warnings.warn(text)\n'),
		).toBe('Killed while saving');
	});

	it('answers the error of a traceback, not its source lines', () => {
		const traceback =
			'Traceback (most recent call last):\n  File "run.py", line 3, in <module>\n    run()\nValueError: bad\n';
		expect(complaintOf(traceback)).toBe('ValueError: bad');
	});

	it('starts a new count when a bar of the same length begins again', () => {
		const stream = ' 8/8 [00:08<00:00]\nError while loading a key\n 0/8 [00:00<?, ?it/s]\n 2/8 [00:02<00:06]\nsaving\n';
		expect(complaintOf(stream)).toBe('saving');
	});

	it('takes an error written in lower case for one', () => {
		expect(complaintOf('uncaught exception of type std::runtime_error\nshutting down\n')).toBe(
			'uncaught exception of type std::runtime_error',
		);
	});

	it('starts a new count for a bar of another length at the same step', () => {
		expect(complaintOf(' 3/8 [00:03<00:05]\nError while loading a key\n 3/10 [00:03<00:07]\nsaving\n')).toBe('saving');
	});

	it('does not take a message with a count in brackets for a bar', () => {
		expect(complaintOf('ValueError: shape 1/2 [batch] wrong\n')).toBe('ValueError: shape 1/2 [batch] wrong');
	});

	it('shows a character cut off at the very end instead of dropping it', () => {
		const line = Buffer.from('OSError: 90 °C');
		expect(complaintOf(line.subarray(0, 13))).toBe('OSError: 90 \uFFFD');
	});

	it('does not take a word that only starts like an error for one', () => {
		expect(complaintOf('Errors were ignored\nplain last line\n')).toBe('plain last line');
	});
});
