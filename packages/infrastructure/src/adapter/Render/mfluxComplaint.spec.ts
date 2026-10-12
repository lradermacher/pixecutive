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

	it('keeps the end of a line that never ends, not its start', () => {
		const pieces = ['HEAD ', ...Array.from({ length: 50 }, () => 'x'.repeat(1000)), ' TAIL'];
		const said = complaintOf(...pieces);
		expect([said.startsWith('HEAD'), said.length]).toEqual([false, 300]);
	});

	it('does not take a word that only starts like an error for one', () => {
		expect(complaintOf('Errors were ignored\nplain last line\n')).toBe('plain last line');
	});
});
