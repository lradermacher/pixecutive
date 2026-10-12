// localRenderer-mflux.adapter.ts — renders one image with mflux on this Mac, one job at a time, under a memory guard.
import { type ChildProcess, spawn } from 'node:child_process';
import type { EventEmitter } from 'node:events';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
	type IClock,
	type ILocalRenderer,
	type RenderJob,
	type RenderResult,
	type RenderStatus,
	RenderException,
	RenderExceptionKey,
} from '@pixecutive/core';
import { judgeMemory } from './judgeMemory.ts';
import { MfluxComplaint } from './mfluxComplaint.ts';
import { MemoryAction } from './memoryAction.enum.ts';
import type { MemoryReading } from './memoryReading.interface.ts';
import { onDisk } from './onDisk.ts';
import { RenderLock } from './renderLock.ts';
import { renderLogRow } from './renderLogRow.ts';
import { RunEnd } from './runEnd.enum.ts';

/** Where mflux and its weights live, and how the guard reads the memory; the app builds it from its configuration. */
export interface MfluxRenderConfig {
	readonly rendersDir: string;
	readonly mflux: string;
	readonly lora: string;
	readonly intervalMs: number;
	readonly readMemory: () => MemoryReading;
	readonly clock: IClock;
	/** Where Ctrl-C and a closed terminal arrive; the process itself in production, a plain emitter in tests. */
	readonly interrupts: EventEmitter;
}

/** What one run of the model measured. */
interface RunOutcome {
	readonly firstStepSeconds: number | null;
	readonly totalSeconds: number;
	readonly secondsPerStep: number | null;
	readonly peakPressure: number;
	readonly swapPeakMb: number;
	readonly end: RunEnd;
	/** What was measured when the run did not finish; empty when it did. */
	readonly reason: string;
}

/** The edit model and its eight-step Lightning LoRA, the settings every approved render of the figures used. */
const model = 'mlx-community/qwen-image-edit-2511-8bit';
const steps = 8;

/** How many log rows the status shows. */
const statusRows = 5;

/** The signals of Ctrl-C and of a closing terminal; either stops the render, which still writes its log row. */
const interruptSignals: readonly NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];

/** The word the log's result column holds for each end of a run; a reason follows it for every end but done. */
const logWord: Readonly<Record<RunEnd, string>> = Object.freeze({
	[RunEnd.Done]: 'done',
	[RunEnd.Aborted]: 'ABORT',
	[RunEnd.Interrupted]: 'ABORT',
	[RunEnd.StorageFailed]: 'STORAGE',
	[RunEnd.Failed]: 'FAILED',
});

/** The render key for each end of a run that did not finish; a new end fails the type check until it has one. */
const endKey: Readonly<Record<Exclude<RunEnd, RunEnd.Done>, RenderExceptionKey>> = Object.freeze({
	[RunEnd.Aborted]: RenderExceptionKey.Aborted,
	[RunEnd.Interrupted]: RenderExceptionKey.Interrupted,
	[RunEnd.StorageFailed]: RenderExceptionKey.StorageFailed,
	[RunEnd.Failed]: RenderExceptionKey.Failed,
});

/**
 * One render at a time: the lock refuses a second one, a start under memory pressure is refused, and a running render
 * is stopped at critical pressure, past the swap limit or by an interrupt; a second interrupt ends a model that ignores
 * the first. mflux writes beside the result, so only a finished run replaces an earlier image. Every run that starts
 * the model leaves one row in `renders.tsv`.
 * @throws {RenderException} from `render` and `status`, with the key of the failure; never a plain error.
 */
export class LocalRendererMfluxAdapter implements ILocalRenderer {
	constructor(private readonly config: MfluxRenderConfig) {}

	/**
	 * Renders `job` into the renders folder and logs the run.
	 * @throws {RenderException} invalid job for a missing input, busy, memory pressure before the start, memory
	 * unreadable, aborted by the guard, interrupted, storage failed, or failed in mflux.
	 */
	async render(job: RenderJob): Promise<RenderResult> {
		const { rendersDir } = this.config;
		onDisk('create the renders folder', () => mkdirSync(rendersDir, { recursive: true }));
		// A wrong path is refused before the model loads for half a minute only to fail on it.
		const inputs: readonly (readonly [string, string])[] = [
			['prompt file', job.promptFile],
			['input image', job.inputImage],
		];
		for (const [what, path] of inputs) {
			if (!existsSync(path)) throw new RenderException(RenderExceptionKey.InvalidJob, `${what} ${path} does not exist`);
		}
		const lock = new RenderLock(join(rendersDir, 'current.lock'));
		const running = lock.running();
		if (running !== null) throw new RenderException(RenderExceptionKey.Busy, `a render is running (${running})`);
		const start = this.memory();
		const entry = judgeMemory(false, start.pressure, 0);
		if (entry.action !== MemoryAction.Go) throw new RenderException(RenderExceptionKey.MemoryPressure, entry.reason);
		const base = basename(job.promptFile, '.txt');
		const name = `${base}-s${String(job.seed)}`;
		const image = join(rendersDir, `${name}.png`);
		const rendering = join(rendersDir, `${name}.rendering.png`);
		onDisk('remove an unfinished image of an earlier run', () => {
			rmSync(rendering, { force: true });
		});
		lock.take(name);
		try {
			const outcome = await this.run(start, this.argv(job, rendering), (mfluxPid, progress) => {
				lock.update([process.pid, mfluxPid], progress === '' ? name : `${name} ${progress}`);
			});
			const { end, reason } = this.place(outcome, rendering, image);
			const result = end === RunEnd.Done ? logWord[end] : `${logWord[end]}: ${reason}`;
			const row = renderLogRow({
				at: this.config.clock.now(),
				name: base,
				seed: job.seed,
				model,
				steps,
				size: `${String(job.width)}x${String(job.height)}`,
				firstStepSeconds: outcome.firstStepSeconds,
				totalSeconds: outcome.totalSeconds,
				secondsPerStep: outcome.secondsPerStep,
				peakPressure: outcome.peakPressure,
				swapPeakMb: outcome.swapPeakMb,
				result,
			});
			onDisk('append the log row', () => {
				appendFileSync(join(rendersDir, 'renders.tsv'), `${row}\n`);
			});
			if (end !== RunEnd.Done) throw new RenderException(endKey[end], result);
			return { name, image };
		} finally {
			// An unfinished image must not lie beside the earlier one, where it would look like a result.
			onDisk('remove the unfinished image', () => {
				rmSync(rendering, { force: true });
			});
			lock.release();
		}
	}

	/**
	 * The running render, the memory and the last log rows.
	 * @throws {RenderException} the unreadable memory key, or the storage key when the lock or the log cannot be read.
	 */
	status(): RenderStatus {
		const log = join(this.config.rendersDir, 'renders.tsv');
		const memory = this.memory();
		return {
			running: new RenderLock(join(this.config.rendersDir, 'current.lock')).running(),
			pressure: memory.pressure,
			swapMb: memory.swapMb,
			lastRows: existsSync(log)
				? onDisk('read the log', () => readFileSync(log, 'utf8'))
						.trim()
						.split('\n')
						.slice(-statusRows)
				: [],
		};
	}

	/**
	 * The machine's memory as the guard needs it.
	 * @throws {RenderException} the unreadable memory key, because a render without its guard must not start.
	 */
	private memory(): MemoryReading {
		try {
			return this.config.readMemory();
		} catch (failure) {
			throw new RenderException(RenderExceptionKey.MemoryUnreadable, (failure as Error).message);
		}
	}

	/**
	 * Moves the image of a finished run into place and answers how the run ended: a run that wrote nothing failed,
	 * and a run whose image cannot be moved ended in storage, before its log row is written.
	 */
	private place(outcome: RunOutcome, rendering: string, image: string): { end: RunEnd; reason: string } {
		if (outcome.end !== RunEnd.Done) return outcome;
		if (!existsSync(rendering)) return { end: RunEnd.Failed, reason: 'no image' };
		try {
			onDisk('move the image into place', () => {
				renameSync(rendering, image);
			});
			return outcome;
		} catch (failure) {
			return {
				end: RunEnd.StorageFailed,
				reason: failure instanceof RenderException ? failure.detail : String(failure),
			};
		}
	}

	/** The mflux call for one job. */
	private argv(job: RenderJob, image: string): string[] {
		return [
			this.config.mflux,
			...['--model', model, '--base-model', 'qwen-image-edit'],
			...['--prompt-file', job.promptFile, '--image-paths', job.inputImage],
			...['--seed', String(job.seed), '--output', image, '--guidance', '1.0', '--steps', String(steps)],
			...['--lora-paths', this.config.lora, '--lora-scales', '1.0', '--no-bake-lora'],
			...['--width', String(job.width), '--height', String(job.height)],
			...['--vae-tiling', '--vae-tile-size', '256', '--mlx-cache-limit-gb', '4'],
		];
	}

	/**
	 * Runs mflux under the guard; `mark` hears mflux's process ID at the start and with every new step as `n/total`,
	 * so the lock names the model from its first moment.
	 */
	private run(
		start: MemoryReading,
		argv: readonly string[],
		mark: (mfluxPid: number, progress: string) => void,
	): Promise<RunOutcome> {
		const [binary = '', ...rest] = argv;
		const startedAt = Date.now();
		let firstStepAt: number | null = null;
		let lastStep = '';
		// mflux says why it failed on its error output: its last error line, else its last line that is no progress line.
		const complaint = new MfluxComplaint();
		let peakPressure = start.pressure;
		let swapPeakMb = 0;
		let end = RunEnd.Done;
		let reason = '';
		/** Records why the run stops; the first end wins, so a later failure of the stopped model does not hide it. */
		const stop = (why: RunEnd, what: string): void => {
			if (end !== RunEnd.Done) return;
			end = why;
			reason = what;
		};
		const outcome = (): RunOutcome => {
			const perStep = /([0-9.]+)s\/it/.exec(lastStep)?.[1];
			return {
				firstStepSeconds: firstStepAt === null ? null : Math.round((firstStepAt - startedAt) / 1000),
				totalSeconds: Math.round((Date.now() - startedAt) / 1000),
				secondsPerStep: perStep === undefined ? null : Number(perStep),
				peakPressure,
				swapPeakMb,
				end,
				reason,
			};
		};
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
			// A throw inside a listener would reach no promise: a failed lock write stops mflux and ends the run.
			const tell = (progress: string): void => {
				try {
					mark(child.pid ?? 0, progress);
				} catch (failure) {
					stop(RunEnd.StorageFailed, failure instanceof RenderException ? failure.detail : String(failure));
					child.kill('SIGTERM');
				}
			};
			if (child.pid !== undefined) tell('');
			const watchOutput = (chunk: Buffer): void => {
				const text = chunk.toString().replaceAll('\r', '\n');
				const step = [...text.matchAll(/ ([0-9]+)\/([0-9]+) \[[^\]]*\]/g)].at(-1);
				if (step === undefined) return;
				lastStep = step[0];
				tell(`${step[1] ?? ''}/${step[2] ?? ''}`);
				if (firstStepAt === null && Number(step[1]) >= 1) firstStepAt = Date.now();
			};
			child.stdout?.on('data', watchOutput);
			child.stderr?.on('data', watchOutput);
			child.stderr?.on('data', (chunk: Buffer) => {
				complaint.listen(chunk);
			});
			child.on('error', (failure) => {
				stop(RunEnd.Failed, failure.message);
			});
			// The first interrupt asks mflux to stop; a further one ends a model that ignores it, whatever stopped the run.
			let interrupts = 0;
			const interrupt = (): void => {
				interrupts += 1;
				stop(RunEnd.Interrupted, 'interrupted');
				child.kill(interrupts > 1 ? 'SIGKILL' : 'SIGTERM');
			};
			for (const signal of interruptSignals) this.config.interrupts.on(signal, interrupt);
			const watch = setInterval(() => {
				let now: MemoryReading;
				try {
					now = this.config.readMemory();
				} catch {
					stop(RunEnd.Aborted, 'the memory cannot be read');
					child.kill('SIGTERM');
					return;
				}
				peakPressure = Math.max(peakPressure, now.pressure);
				swapPeakMb = Math.max(swapPeakMb, now.swapMb - start.swapMb);
				const verdict = judgeMemory(true, now.pressure, now.swapMb - start.swapMb);
				if (verdict.action === MemoryAction.Abort) {
					stop(RunEnd.Aborted, verdict.reason);
					child.kill('SIGTERM');
				}
			}, this.config.intervalMs);
			child.on('close', (code) => {
				clearInterval(watch);
				for (const signal of interruptSignals) this.config.interrupts.off(signal, interrupt);
				const said = complaint.finish();
				if (code !== 0) stop(RunEnd.Failed, said === '' ? `exit ${String(code)}` : `exit ${String(code)}: ${said}`);
				resolve(outcome());
			});
		});
	}
}
