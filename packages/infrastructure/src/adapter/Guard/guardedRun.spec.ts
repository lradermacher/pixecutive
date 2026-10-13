import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type GuardedRunHooks, guardedRun, type StepSeen } from './guardedRun.ts';
import type { MemoryReading } from './memoryReading.interface.ts';
import { RunEnd } from './runEnd.enum.ts';

/** A model that runs `body` as a shell script. */
function model(body: string): string {
	const path = join(mkdtempSync(join(tmpdir(), 'guarded-')), 'model');
	writeFileSync(path, `#!/bin/sh\n${body}\n`);
	chmodSync(path, 0o755);
	return path;
}

/** Hooks that read `n/total` from any line, keep what they heard, and name failures by their message. */
function hooks(markThrows = false): GuardedRunHooks & { marks: string[]; said: string[] } {
	const marks: string[] = [];
	const said: string[] = [];
	return {
		marks,
		said,
		mark: (pid, progress): void => {
			if (markThrows && progress !== '') throw new TypeError(`lock gone at ${progress}`);
			marks.push(pid > 0 ? progress : 'no pid');
		},
		step: (text): StepSeen | null => {
			const found = [...text.matchAll(/step (\d+)\/(\d+)/g)].at(-1);
			return found ? { done: Number(found[1]), total: Number(found[2]), line: found[0] } : null;
		},
		listen: (chunk): void => {
			said.push(chunk.toString().trim());
		},
		complaint: () => said.at(-1) ?? '',
		describe: (failure) => (failure as Error).message,
	};
}

/** Runs `argv` with the memory readings given in turn (the last one repeats) and the interrupts emitter. */
function run(
	argv: string[],
	how: ReturnType<typeof hooks>,
	readings: MemoryReading[] = [{ pressure: 1, swapMb: 0 }],
	interrupts = new EventEmitter(),
): ReturnType<typeof guardedRun> {
	let reads = 0;
	return guardedRun(
		{
			argv,
			start: { pressure: 1, swapMb: 0 },
			readMemory: () => readings[Math.min(reads++, readings.length - 1)] ?? { pressure: 1, swapMb: 0 },
			intervalMs: 20,
			interrupts,
		},
		how,
	);
}

describe('guardedRun', () => {
	it('ends done and marks the start and every new step', async () => {
		const how = hooks();
		const outcome = await run([model('echo "step 1/2"; sleep 0.05; echo "step 2/2"')], how);
		expect([outcome.end, outcome.reason, outcome.lastStepLine]).toEqual([RunEnd.Done, '', 'step 2/2']);
		expect(how.marks).toEqual(['', '1/2', '2/2']);
	});

	it('ends failed with the exit code and what the model complained of', async () => {
		const outcome = await run([model('echo "no weights" >&2; exit 3')], hooks());
		expect([outcome.end, outcome.reason]).toEqual([RunEnd.Failed, 'exit 3: no weights']);
	});

	// `sleep 5; echo after` makes every shell fork the sleep, as a model that starts its own processes does.
	it('stops the model at critical memory pressure and keeps the guard as the reason', async () => {
		const outcome = await run([model('sleep 5; echo after')], hooks(), [{ pressure: 4, swapMb: 0 }]);
		expect([outcome.end, outcome.reason, outcome.peakPressure]).toEqual([RunEnd.Aborted, 'memory pressure level 4', 4]);
	});

	it('stops the model at an interrupt', async () => {
		const interrupts = new EventEmitter();
		setTimeout(() => interrupts.emit('SIGINT'), 50);
		const outcome = await run([model('sleep 5; echo after')], hooks(), undefined, interrupts);
		expect([outcome.end, outcome.reason]).toEqual([RunEnd.Interrupted, 'interrupted']);
		expect(interrupts.listenerCount('SIGINT')).toBe(0);
	});

	// The child holds the output pipe, so the run ends only once the child is gone; it would sleep 30 s on its own.
	it('stops every process the model started, not only the model', async () => {
		const pidFile = join(mkdtempSync(join(tmpdir(), 'guarded-')), 'child.pid');
		const interrupts = new EventEmitter();
		const started = setInterval(() => {
			if (existsSync(pidFile) && readFileSync(pidFile, 'utf8').trim() !== '') interrupts.emit('SIGINT');
		}, 10);
		const startedAt = Date.now();
		const outcome = await run([model(`sleep 30 & echo $! > ${pidFile}; wait`)], hooks(), undefined, interrupts).finally(
			() => {
				clearInterval(started);
			},
		);
		expect([outcome.end, Date.now() - startedAt < 2000]).toEqual([RunEnd.Interrupted, true]);
	});

	it('stops every process the model started when the guard itself exits', async () => {
		const pidFile = join(mkdtempSync(join(tmpdir(), 'guarded-')), 'child.pid');
		const interrupts = new EventEmitter();
		const started = setInterval(() => {
			if (existsSync(pidFile) && readFileSync(pidFile, 'utf8').trim() !== '') interrupts.emit('exit');
		}, 10);
		const startedAt = Date.now();
		const outcome = await run([model(`sleep 30 & echo $! > ${pidFile}; wait`)], hooks(), undefined, interrupts).finally(
			() => {
				clearInterval(started);
			},
		);
		expect([outcome.end, Date.now() - startedAt < 2000]).toEqual([RunEnd.Interrupted, true]);
	});

	it('stops the model when a mark fails and names the failure', async () => {
		const outcome = await run([model('echo "step 1/2"; exec sleep 5')], hooks(true));
		expect([outcome.end, outcome.reason]).toEqual([RunEnd.StorageFailed, 'lock gone at 1/2']);
	});

	it('ends failed when the model cannot start', async () => {
		const outcome = await run([join(tmpdir(), 'no-such-model')], hooks());
		expect(outcome.end).toBe(RunEnd.Failed);
		expect(outcome.reason).toMatch(/ENOENT/);
	});
});
