// localRenderer-mflux.adapter.ts — renders one image with mflux on this Mac, one job at a time, under a memory guard.
import type { EventEmitter } from 'node:events';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
	type ILocalRenderer,
	type RenderJob,
	type RenderResult,
	type RenderStatus,
	RenderException,
	RenderExceptionKey,
} from '@pixecutive/core';
import { judgeMemory } from '../Guard/judgeMemory.ts';
import { MfluxComplaint } from './mfluxComplaint.ts';
import { mfluxProgress } from './mfluxProgress.ts';
import { MemoryAction } from '../Guard/memoryAction.enum.ts';
import type { MemoryReading } from '../Guard/memoryReading.interface.ts';
import { onDisk } from './onDisk.ts';
import { LocalJobLock } from '../Guard/localJobLock.ts';
import { LockFailure } from '../Guard/lockFailure.enum.ts';
import { renderLogRow } from './renderLogRow.ts';
import { guardedRun } from '../Guard/guardedRun.ts';
import { RunEnd } from '../Guard/runEnd.enum.ts';

/** The shared lock's failures as render keys: another job is busy, or the renders folder failed. */
function nameLockFailure(failure: LockFailure, detail: string): RenderException {
	return new RenderException(
		failure === LockFailure.Busy ? RenderExceptionKey.Busy : RenderExceptionKey.StorageFailed,
		detail,
	);
}

/** Where mflux and its weights live, and how the guard reads the memory; the app builds it from its configuration. */
export interface MfluxRenderConfig {
	readonly rendersDir: string;
	readonly mflux: string;
	readonly lora: string;
	readonly intervalMs: number;
	readonly readMemory: () => MemoryReading;
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
		const lock = new LocalJobLock(join(rendersDir, 'current.lock'), nameLockFailure);
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
				at: new Date(),
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
			running: new LocalJobLock(join(this.config.rendersDir, 'current.lock'), nameLockFailure).running(),
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
	 * Runs mflux under the shared guard; `mark` hears mflux's process ID at the start and with every new step as
	 * `n/total`, so the lock names the model from its first moment.
	 */
	private async run(
		start: MemoryReading,
		argv: readonly string[],
		mark: (mfluxPid: number, progress: string) => void,
	): Promise<RunOutcome> {
		// mflux says why it failed on its error output: its last error, else its last plain line, else its last warning.
		const complaint = new MfluxComplaint();
		const run = await guardedRun(
			{
				argv,
				start,
				readMemory: this.config.readMemory,
				intervalMs: this.config.intervalMs,
				interrupts: this.config.interrupts,
			},
			{
				mark,
				step: (text) => {
					const step = text
						.split('\n')
						.map((line) => mfluxProgress.exec(line))
						.filter((found) => found !== null)
						.at(-1);
					return step === undefined ? null : { done: Number(step[1]), total: Number(step[2]), line: step[0] };
				},
				listen: (chunk) => {
					complaint.listen(chunk);
				},
				complaint: () => complaint.finish(),
				describe: (failure) => (failure instanceof RenderException ? failure.detail : String(failure)),
			},
		);
		const perStep = /([0-9.]+)s\/it/.exec(run.lastStepLine)?.[1];
		return {
			firstStepSeconds: run.firstStepSeconds,
			totalSeconds: run.totalSeconds,
			secondsPerStep: perStep === undefined ? null : Number(perStep),
			peakPressure: run.peakPressure,
			swapPeakMb: run.swapPeakMb,
			end: run.end,
			reason: run.reason,
		};
	}
}
