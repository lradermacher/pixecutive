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
});

describe('MfluxComplaint and the shapes of Python output', () => {
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

	it('reads the error inside the frame of an exception group', () => {
		const group = [
			'  + Exception Group Traceback (most recent call last):',
			'  |   File "run.py", line 3, in <module>',
			'  | ExceptionGroup: renders failed (1 sub-exception)',
			'  +-+---------------- 1 ----------------',
			'    | Traceback (most recent call last):',
			'    |   File "run.py", line 2, in render',
			'    | TypeError: width must be an integer',
			'    +------------------------------------',
			'',
		].join('\n');
		expect(complaintOf(group)).toBe('TypeError: width must be an integer');
	});

	it('takes a logging warning for a warning, not for an error it names', () => {
		expect(
			complaintOf('WARNING:root:connection error, using the cached weights\nSaving image failed: disk full\n'),
		).toBe('Saving image failed: disk full');
	});

	it('reads a message written over the padding and cursor move of a cleared nested bar, however it is cut', () => {
		// tqdm clears a nested bar with a carriage return, padding as wide as the bar and a cursor move, in a write of its
		// own; the message follows in the next write.
		const stream = `\r${' '.repeat(44)}\u001b[A` + 'ValueError: no space left on device\n';
		const answers = new Set(
			[1, 5, 10, 30, 45, 46, 63, 64, 70, stream.length].map((size) => {
				const chunks = Array.from({ length: Math.ceil(stream.length / size) }, (_, at) =>
					stream.slice(at * size, (at + 1) * size),
				);
				return complaintOf(...chunks);
			}),
		);
		expect([...answers]).toEqual(['ValueError: no space left on device']);
	});

	it('reads a message behind padding as wide as a terminal while its line has not ended', () => {
		expect(complaintOf(`\r${' '.repeat(4000)}`, 'ValueError: disk full', '\n')).toBe('ValueError: disk full');
	});
});

describe('MfluxComplaint and the end of a Python run', () => {
	it('does not take the error of a traceback Python ignores at shutdown', () => {
		const stream = [
			'RuntimeError: [METAL] Command buffer execution failed',
			'Exception ignored in: <function Model.__del__ at 0x1>',
			'Traceback (most recent call last):',
			'  File "model.py", line 9, in __del__',
			"AttributeError: 'NoneType' object has no attribute 'free'",
			'',
		].join('\n');
		expect(complaintOf(stream)).toBe('RuntimeError: [METAL] Command buffer execution failed');
	});
});

describe('MfluxComplaint and the end of a traceback', () => {
	it('answers a warning that -W error turned into the exception ending a traceback, past its marks', () => {
		const stream = [
			'Killed while saving',
			'Traceback (most recent call last):',
			'  File "/opt/py/run.py", line 3, in render',
			'    return warnings.warn("weights cached " + str(attempt))',
			`${' '.repeat(20)}~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^`,
			'UserWarning: weights cached 1',
			'',
		].join('\n');
		expect(complaintOf(stream)).toBe('UserWarning: weights cached 1');
	});

	it('reads a statement over several lines in a newer traceback as part of it, not as its end', () => {
		const stream = [
			'Traceback (most recent call last):',
			'  File "/opt/py/run.py", line 4, in render',
			'    return load("/models/flux-weights",',
			`${' '.repeat(25)}2)`,
			'  File "/opt/py/run.py", line 2, in load',
			'    raise KeyboardInterrupt',
			'KeyboardInterrupt',
			'',
		].join('\n');
		expect(complaintOf(stream)).toBe('KeyboardInterrupt');
	});

	it('reads the exception behind the padding of a bar another thread cleared inside a traceback', () => {
		const stream = [
			'Traceback (most recent call last):',
			'  File "/opt/py/run.py", line 4, in render',
			`${' '.repeat(44)}\u001b[AValueError: weights missing`,
			'',
		].join('\n');
		expect(complaintOf(stream)).toBe('ValueError: weights missing');
	});

	it('keeps the indentation of a colored traceback, whose color codes move no cursor', () => {
		const stream = [
			'Traceback (most recent call last):',
			'  File "/opt/py/run.py", line 4, in render',
			'    return load("/models/flux-weights",',
			`${' '.repeat(25)}\u001b[35m2\u001b[0m)`,
			'\u001b[35mWeightsMissing\u001b[0m: /models/flux-weights',
			'',
		].join('\n');
		expect(complaintOf(stream)).toBe('WeightsMissing: /models/flux-weights');
	});

	it("keeps Python's indentation behind the padding of a bar another thread cleared inside a traceback", () => {
		const stream = [
			'Traceback (most recent call last):',
			`${' '.repeat(44)}\u001b[A  File "/opt/py/run.py", line 4, in render`,
			'KeyboardInterrupt',
			'',
		].join('\n');
		expect(complaintOf(stream)).toBe('KeyboardInterrupt');
	});
});

describe('MfluxComplaint and tqdm inside a traceback', () => {
	it('keeps the exception when the bar tqdm draws at the end shows a step it never drew, with a warning after it', () => {
		const stream = [
			'Traceback (most recent call last):',
			'ValueError: weights missing',
			`\r${' '.repeat(37)}\u001b[A\u001b[A\r 38%|███▊      | 3/8 [00:00<00:00, 1276.55it/s]`,
			'UserWarning: resource_tracker: There appear to be 1 leaked semaphore',
			'',
		].join('\n');
		expect(complaintOf(stream)).toBe('ValueError: weights missing');
	});

	it.each([
		['two cursor moves up', `${' '.repeat(44)}\u001b[A\u001b[A`],
		['a color code before the padding', `\u001b[0m${' '.repeat(44)}\u001b[A`],
		['an erase code after the padding', `${' '.repeat(44)}\u001b[K\u001b[A`],
	])('reads the exception behind a cleared bar with %s inside a traceback', (_shape, clear) => {
		const stream = ['Traceback (most recent call last):', `${clear}ValueError: weights missing`, ''].join('\n');
		expect(complaintOf(stream)).toBe('ValueError: weights missing');
	});

	it('reads only the line that ends a traceback as its exception, not a warning after it', () => {
		const stream = [
			'Traceback (most recent call last):',
			'  File "/opt/py/run.py", line 4, in render',
			'RuntimeError: first try failed',
			'UserWarning: retrying without the cache',
			'',
		].join('\n');
		expect(complaintOf(stream)).toBe('RuntimeError: first try failed');
	});

	it('forgets a traceback cut off before its end once Python reports an ignored one', () => {
		const stream = [
			'Traceback (most recent call last):',
			'Exception ignored in: <function Model.__del__ at 0x1>',
			'Traceback (most recent call last):',
			"KeyError: 'weights'",
			'UserWarning: at shutdown',
			'',
		].join('\n');
		expect(complaintOf(stream)).toBe('Traceback (most recent call last):');
	});

	it('forgets a traceback cut off before its end once a bar runs again', () => {
		expect(
			complaintOf('Traceback (most recent call last):\n 3/8 [00:03<00:05, 1.0s/it]\nUserWarning: resource_tracker\n'),
		).toBe('Traceback (most recent call last):');
	});

	it('takes up a real error again once an ignored traceback has ended, whatever it ended with', () => {
		const stream = [
			'Exception ignored in: <function Model.__del__ at 0x1>',
			'Traceback (most recent call last):',
			'  File "model.py", line 9, in __del__',
			'KeyboardInterrupt: ',
			'Exception ignored in: <function Pool.__del__ at 0x2>',
			'SystemExit: 3',
			'ValueError: real later error',
			'',
		].join('\n');
		expect(complaintOf(stream)).toBe('ValueError: real later error');
	});

	it('knows the wording of an ignored traceback in newer Python', () => {
		const stream = [
			'RuntimeError: [METAL] Command buffer execution failed',
			'Exception ignored while calling deallocator <function Model.__del__ at 0x1>:',
			'Traceback (most recent call last):',
			'  File "model.py", line 9, in __del__',
			'ValueError: freed twice',
			'',
		].join('\n');
		expect(complaintOf(stream)).toBe('RuntimeError: [METAL] Command buffer execution failed');
	});
});

describe('MfluxComplaint and the warnings Python prints', () => {
	it('takes an error whose message speaks of a warning for an error', () => {
		expect(
			complaintOf('RuntimeError: the warning threshold of the memory guard was exceeded\nUserWarning: at shutdown\n'),
		).toBe('RuntimeError: the warning threshold of the memory guard was exceeded');
	});

	it('takes a plain line that speaks of a warning for a plain line', () => {
		expect(complaintOf('Killed near the warning threshold\nUserWarning: at shutdown\n')).toBe(
			'Killed near the warning threshold',
		);
	});

	it('takes a warning raised in a file named for an error for a warning', () => {
		expect(
			complaintOf('Killed while saving\nloader/error.py:3: UserWarning: weights cached\n  warnings.warn(text)\n'),
		).toBe('Killed while saving');
	});

	it('finds where a warning was raised in any path, and compares its label on what follows', () => {
		const warnings = [
			'/opt/py/with space/error.py:3: UserWarning: weights cached',
			'/opt/py/with:colon/error.py:3: UserWarning: weights cached',
			'C:\\py\\error.py:3: UserWarning: weights cached',
			'/opt/py/net.py:3: UserWarning: ConnectionError, retried',
		];
		expect(warnings.map((warning) => complaintOf(`Killed while saving\n${warning}\n`))).toEqual(
			warnings.map(() => 'Killed while saving'),
		);
	});

	it('takes a warning from a file whose name is an error word, or with a time in its message, for a warning', () => {
		const warnings = ['error.py:3: UserWarning: weights cached', '/opt/py/run.py:5: RuntimeWarning: 12:30: overflow'];
		expect(warnings.map((warning) => complaintOf(`Killed while saving\n${warning}\n`))).toEqual(
			warnings.map(() => 'Killed while saving'),
		);
	});

	it('does not take a clock time or a count in an error for the place of a warning', () => {
		const errors = [
			'ERROR 12:30:45: model failed (warning: low memory)',
			'RuntimeError at 12:30:45: warning: x',
			'ValueError: tensor at 3:4: UserWarning: x',
		];
		expect(errors.map((error) => complaintOf(`${error}\nshutting down\n`))).toEqual(errors);
	});

	it('takes a warning of the bare Warning category for a warning', () => {
		expect(complaintOf('Killed while saving\nloader/error.py:2: Warning: base class used\n')).toBe(
			'Killed while saving',
		);
	});

	it('takes a warning with an empty message, or one from a frozen module, for a warning', () => {
		const warnings = ['weights/error.py:2: UserWarning: ', '<frozen error>:3: UserWarning: imported twice'];
		expect(warnings.map((warning) => complaintOf(`Killed while saving\n${warning}\n`))).toEqual(
			warnings.map(() => 'Killed while saving'),
		);
	});

	it('does not take the name in brackets inside an error for the place of a warning', () => {
		expect(complaintOf('failed in <error>:3: UserWarning: x\nshutting down\n')).toBe(
			'failed in <error>:3: UserWarning: x',
		);
	});

	it("sets aside only Python's own place of a warning, not any tool's file and line", () => {
		expect(complaintOf('error.py:12: note: warning: low memory\nshutting down\n')).toBe(
			'error.py:12: note: warning: low memory',
		);
	});

	it('takes a warning label behind an error for part of the error', () => {
		expect(complaintOf("ValueError: unknown action 'warning: x'\nUserWarning: at shutdown\n")).toBe(
			"ValueError: unknown action 'warning: x'",
		);
	});

	it('shows a character cut off at the very end instead of dropping it', () => {
		const line = Buffer.from('OSError: 90 °C');
		expect(complaintOf(line.subarray(0, 13))).toBe('OSError: 90 \uFFFD');
	});

	it('does not take a word that only starts like an error for one', () => {
		expect(complaintOf('Errors were ignored\nplain last line\n')).toBe('plain last line');
	});
});
