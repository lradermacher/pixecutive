// guardedRun.ts — runs one local model process under the memory guard: refused memory stops it, an interrupt asks it
// to stop and a second one ends it, its progress reaches the caller with every new step, and the first reason it
// stopped for wins. What the model prints and how a failure is named stays with the calling adapter.
import { type ChildProcess, spawn } from 'node:child_process';
import type { EventEmitter } from 'node:events';
import { judgeMemory } from './judgeMemory.ts';
import { MemoryAction } from './memoryAction.enum.ts';
import type { MemoryReading } from './memoryReading.interface.ts';
import { RunEnd } from './runEnd.enum.ts';

/** The signals of Ctrl-C and of a closing terminal; either stops the run, which still ends with its outcome. */
const interruptSignals: readonly NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];

/** The process to run, the memory at its start, how to read the memory and how often, and where interrupts arrive. */
export interface GuardedRunSetup {
	readonly argv: readonly string[];
	readonly start: MemoryReading;
	readonly readMemory: () => MemoryReading;
	readonly intervalMs: number;
	readonly interrupts: EventEmitter;
}

/** One step the model reported: how many of how many, and the line it was read from. */
export interface StepSeen {
	readonly done: number;
	readonly total: number;
	readonly line: string;
}

/** What the calling adapter knows about its model. */
export interface GuardedRunHooks {
	/** Hears the process ID at the start (progress empty) and `done/total` with every new step; a failure stops the run. */
	mark(pid: number, progress: string): void;
	/** The newest step in a chunk of output, or null. */
	step(text: string): StepSeen | null;
	/** Hears every chunk of error output. */
	listen(chunk: Buffer): void;
	/** What the model said when it failed, read once it ended. */
	complaint(): string;
	/** The detail of a failure `mark` threw. */
	describe(failure: unknown): string;
}

/** What one guarded run measured, and how and why it ended. */
export interface GuardedOutcome {
	readonly firstStepSeconds: number | null;
	readonly totalSeconds: number;
	readonly lastStepLine: string;
	readonly peakPressure: number;
	readonly swapPeakMb: number;
	readonly end: RunEnd;
	/** What was measured when the run did not finish; empty when it did. */
	readonly reason: string;
}

/** Runs `setup.argv` under the guard and resolves with its outcome; it never rejects. */
export function guardedRun(setup: GuardedRunSetup, hooks: GuardedRunHooks): Promise<GuardedOutcome> {
	const [binary = '', ...rest] = setup.argv;
	const startedAt = Date.now();
	let firstStepAt: number | null = null;
	let lastStepLine = '';
	let peakPressure = setup.start.pressure;
	let swapPeakMb = 0;
	let end = RunEnd.Done;
	let reason = '';
	/** Records why the run stops; the first end wins, so a later failure of the stopped model does not hide it. */
	const stop = (why: RunEnd, what: string): void => {
		if (end !== RunEnd.Done) return;
		end = why;
		reason = what;
	};
	const outcome = (): GuardedOutcome => ({
		firstStepSeconds: firstStepAt === null ? null : Math.round((firstStepAt - startedAt) / 1000),
		totalSeconds: Math.round((Date.now() - startedAt) / 1000),
		lastStepLine,
		peakPressure,
		swapPeakMb,
		end,
		reason,
	});
	return new Promise((resolve) => {
		let child: ChildProcess;
		try {
			child = spawn(binary, rest, { stdio: ['ignore', 'pipe', 'pipe'] });
		} catch (failure) {
			// Some start failures are thrown at once instead of arriving as an error event; both end the same way.
			stop(RunEnd.Failed, (failure as Error).message);
			resolve(outcome());
			return;
		}
		// An exception inside a listener would reach no promise: a failed mark stops the model and ends the run.
		const tell = (progress: string): void => {
			try {
				hooks.mark(child.pid ?? 0, progress);
			} catch (failure) {
				stop(RunEnd.StorageFailed, hooks.describe(failure));
				child.kill('SIGTERM');
			}
		};
		if (child.pid !== undefined) tell('');
		const watchOutput = (chunk: Buffer): void => {
			const step = hooks.step(chunk.toString().replaceAll('\r', '\n'));
			if (step === null) return;
			lastStepLine = step.line;
			tell(`${String(step.done)}/${String(step.total)}`);
			if (firstStepAt === null && step.done >= 1) firstStepAt = Date.now();
		};
		child.stdout?.on('data', watchOutput);
		child.stderr?.on('data', watchOutput);
		child.stderr?.on('data', (chunk: Buffer) => {
			hooks.listen(chunk);
		});
		child.on('error', (failure) => {
			stop(RunEnd.Failed, failure.message);
		});
		// The first interrupt asks the model to stop; a further one ends a model that ignores it, whatever stopped the run.
		let interrupts = 0;
		const interrupt = (): void => {
			interrupts += 1;
			stop(RunEnd.Interrupted, 'interrupted');
			child.kill(interrupts > 1 ? 'SIGKILL' : 'SIGTERM');
		};
		for (const signal of interruptSignals) setup.interrupts.on(signal, interrupt);
		const watch = setInterval(() => {
			let now: MemoryReading;
			try {
				now = setup.readMemory();
			} catch {
				stop(RunEnd.Aborted, 'the memory cannot be read');
				child.kill('SIGTERM');
				return;
			}
			peakPressure = Math.max(peakPressure, now.pressure);
			swapPeakMb = Math.max(swapPeakMb, now.swapMb - setup.start.swapMb);
			const verdict = judgeMemory(true, now.pressure, now.swapMb - setup.start.swapMb);
			if (verdict.action === MemoryAction.Abort) {
				stop(RunEnd.Aborted, verdict.reason);
				child.kill('SIGTERM');
			}
		}, setup.intervalMs);
		child.on('close', (code, signal) => {
			clearInterval(watch);
			for (const name of interruptSignals) setup.interrupts.off(name, interrupt);
			const said = hooks.complaint();
			// A model killed by a signal has no exit code; the signal says what ended it.
			const ended = code === null ? `signal ${signal ?? 'unknown'}` : `exit ${String(code)}`;
			if (code !== 0) stop(RunEnd.Failed, said === '' ? ended : `${ended}: ${said}`);
			resolve(outcome());
		});
	});
}
